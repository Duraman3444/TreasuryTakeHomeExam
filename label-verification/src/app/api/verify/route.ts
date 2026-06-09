import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyLabel } from "@/lib/verifier";
import { withRetry } from "@/lib/retry";

function extractJson(text: string) {
  const clean = text.trim();
  // Strip markdown code block wrappers if they exist
  const match = clean.match(/^```json\s*([\s\S]*?)\s*```$/i) || clean.match(/^```\s*([\s\S]*?)\s*```$/i);
  const jsonStr = match ? match[1] : clean;
  return JSON.parse(jsonStr.trim());
}

export async function POST(req: NextRequest) {
  try {
    const { image, imageType, formValues, apiKeyOverride } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 }
      );
    }

    if (!formValues) {
      return NextResponse.json(
        { error: "Reference form values are required" },
        { status: 400 }
      );
    }

    // Determine the API Key and Provider
    let provider: "gemini" | "claude" = "gemini";
    let apiKey = apiKeyOverride;

    if (apiKey) {
      if (apiKey.startsWith("sk-ant-")) {
        provider = "claude";
      } else {
        provider = "gemini";
      }
    } else {
      // Check environment variables
      if (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY) {
        provider = "claude";
        apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";
      } else if (process.env.GEMINI_API_KEY) {
        provider = "gemini";
        apiKey = process.env.GEMINI_API_KEY;
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "API key is missing. Please set GEMINI_API_KEY, CLAUDE_API_KEY, or ANTHROPIC_API_KEY in your environment, or enter it in the settings panel.",
        },
        { status: 400 }
      );
    }

    // Strip out the data:image/...;base64, prefix if present
    const base64Data = image.includes(";base64,")
      ? image.split(";base64,")[1]
      : image;

    const prompt = `You are a compliance agent reviewing alcohol beverage labels. 
Analyze the provided label image and extract the requested fields. Extract them exactly as they appear on the label.

Return a JSON object with this exact structure:
{
  "brandName": "extracted brand name or null",
  "classType": "extracted class or type designation (e.g. Kentucky Straight Bourbon Whiskey, Vodka, Cider, Beer) or null",
  "abv": "extracted alcohol by volume (ABV) text or null",
  "netContents": "extracted net contents volume (e.g. 750 mL, 12 FL OZ) or null",
  "governmentWarning": "extract the complete, word-for-word government warning text starting with 'GOVERNMENT WARNING:' (include all caps and exact punctuation, numbers, and text) or null",
  "isGovernmentWarningPresent": true/false
}

Do not wrap in markdown or add extra text. Return only the JSON object.`;

    // The provider call is wrapped in withRetry so a transient 429/503 is retried
    // with backoff instead of failing the verification.
    const responseText = await withRetry(async () => {
    let responseText = "";

    if (provider === "claude") {
      // Call Anthropic API using fetch
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imageType || "image/png",
                    data: base64Data,
                  },
                },
                {
                  type: "text",
                  text: prompt,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let parsedErr;
        try {
          parsedErr = JSON.parse(errText);
        } catch {
          // ignore
        }
        const message = parsedErr?.error?.message || errText;
        throw new Error(`Claude API Error: ${response.status} - ${message}`);
      }

      const responseData = await response.json();
      responseText = responseData.content[0].text;
    } else {
      // Initialize the Google Generative AI client
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Use gemini-2.5-flash for faster response times (<2 seconds typically)
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          // temperature 0 -> deterministic extraction so the same label yields the same fields each run
          temperature: 0,
        },
      });

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: imageType || "image/png",
          },
        },
      ]);

      responseText = result.response.text();
    }

    if (!responseText) {
      throw new Error("Empty response from AI compliance model");
    }
    return responseText;
    });

    let extractedData;
    try {
      extractedData = extractJson(responseText);
    } catch {
      console.error("Failed to parse AI response:", responseText);
      throw new Error("AI returned invalid JSON formatting");
    }

    // Run the compliance engine
    const report = verifyLabel(formValues, extractedData);

    return NextResponse.json({
      success: true,
      extracted: extractedData,
      report,
    });
  } catch (error: unknown) {
    console.error("Verification API Error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred during verification";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
