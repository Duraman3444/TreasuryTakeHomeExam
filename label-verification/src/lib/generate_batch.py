import os
import csv
from PIL import Image, ImageDraw, ImageFont

def wrap_text(text, font, max_width, draw):
    words = text.split()
    lines = []
    current_line = []
    
    for word in words:
        current_line.append(word)
        # Check size of line with this word
        test_line = " ".join(current_line)
        bbox = draw.textbbox((0, 0), test_line, font=font)
        w = bbox[2] - bbox[0]
        if w > max_width:
            if len(current_line) > 1:
                # Remove last word and push line
                current_line.pop()
                lines.append(" ".join(current_line))
                current_line = [word]
            else:
                # Word itself is too wide, push anyway
                lines.append(test_line)
                current_line = []
                
    if current_line:
        lines.append(" ".join(current_line))
        
    return lines

def generate_label(filepath, brand_name, class_type, abv_text, net_contents, bottler, country, warning_text, warning_bold=True):
    # Dimensions
    w, h = 600, 500
    img = Image.new("RGB", (w, h), "#FAF8F5") # Soft cream background
    draw = ImageDraw.Draw(img)
    
    # Load fonts
    font_path_bold = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
    font_path_reg = "/System/Library/Fonts/Supplemental/Arial.ttf"
    font_path_italic = "/System/Library/Fonts/Supplemental/Arial Italic.ttf"
    
    try:
        font_brand = ImageFont.truetype(font_path_bold, 28)
        font_class = ImageFont.truetype(font_path_italic, 18)
        font_meta = ImageFont.truetype(font_path_bold, 14)
        font_addr = ImageFont.truetype(font_path_reg, 11)
        font_warn_hdr = ImageFont.truetype(font_path_bold if warning_bold else font_path_reg, 11)
        font_warn_body = ImageFont.truetype(font_path_reg, 10.5)
    except IOError:
        # Fallback to default PIL font
        font_brand = font_class = font_meta = font_addr = font_warn_hdr = font_warn_body = ImageFont.load_default()
        
    # Draw double border
    draw.rectangle([15, 15, w - 15, h - 15], outline="#332B25", width=3)
    draw.rectangle([20, 20, w - 20, h - 20], outline="#332B25", width=1)
    
    # Draw Brand Name
    brand_bbox = draw.textbbox((0, 0), brand_name, font=font_brand)
    brand_w = brand_bbox[2] - brand_bbox[0]
    draw.text(((w - brand_w) / 2, 45), brand_name, fill="#1C1917", font=font_brand)
    
    # Draw Class / Type
    class_bbox = draw.textbbox((0, 0), class_type, font=font_class)
    class_w = class_bbox[2] - class_bbox[0]
    draw.text(((w - class_w) / 2, 95), class_type, fill="#44403C", font=font_class)
    
    # Draw ABV & Net Contents
    meta_str = f"{abv_text}   •   {net_contents}"
    meta_bbox = draw.textbbox((0, 0), meta_str, font=font_meta)
    meta_w = meta_bbox[2] - meta_bbox[0]
    draw.text(((w - meta_w) / 2, 135), meta_str, fill="#1C1917", font=font_meta)
    
    # Draw Bottler details
    addr_parts = [bottler]
    if country:
        addr_parts.append(country)
    addr_str = "   |   ".join(addr_parts)
    addr_bbox = draw.textbbox((0, 0), addr_str, font=font_addr)
    addr_w = addr_bbox[2] - addr_bbox[0]
    draw.text(((w - addr_w) / 2, 168), addr_str, fill="#57534E", font=font_addr)
    
    # Draw Warning Statement box
    warn_box_top = 210
    warn_box_h = 245
    draw.rectangle([35, warn_box_top, w - 35, warn_box_top + warn_box_h], fill="#F3F1ED", outline="#D7D3C9", width=1)
    
    # Split prefix ("GOVERNMENT WARNING:") and body
    prefix = "GOVERNMENT WARNING:"
    body_text = warning_text
    
    if warning_text.lower().startswith("government warning:"):
        prefix_len = len("government warning:")
        prefix = warning_text[:prefix_len]
        body_text = warning_text[prefix_len:].strip()
        
    # Draw prefix (casing and font weight matches properties)
    x_offset = 50
    y_offset = warn_box_top + 20
    draw.text((x_offset, y_offset), prefix, fill="#1C1917", font=font_warn_hdr)
    
    prefix_bbox = draw.textbbox((0, 0), prefix, font=font_warn_hdr)
    prefix_w = prefix_bbox[2] - prefix_bbox[0]
    
    # Wrap and draw body text
    body_lines = wrap_text(body_text, font_warn_body, w - 100, draw)
    
    # First line starts right after the prefix if it fits, or we start on next line.
    # For simplicity, we start the first line on a new row or inline.
    # Let's draw it in line if possible, or just draw the prefix on its own line for a cleaner look.
    # Actually, TTB labels usually have the warning header on the first line, then the body.
    # Let's draw the body starting on the next line to keep spacing uniform and very readable.
    y_offset += 20
    for line in body_lines:
        draw.text((x_offset, y_offset), line, fill="#2E2A24", font=font_warn_body)
        y_offset += 16
        
    # Save Image
    img.save(filepath, "PNG")
    print(f"Generated: {filepath}")

def main():
    dest_dir = "/Users/abdurrahmanmirza/Desktop/Treasurytakehome-rgb/sample-batch"
    os.makedirs(dest_dir, exist_ok=True)
    
    std_warning = (
        "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink "
        "alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption "
        "of alcoholic beverages impairs your ability to drive a car or operate machinery, and may "
        "cause health problems."
    )
    
    # 1. Compliant Bourbon
    generate_label(
        os.path.join(dest_dir, "old_tom.png"),
        brand_name="OLD TOM DISTILLERY",
        class_type="Kentucky Straight Bourbon Whiskey",
        abv_text="45% Alc./Vol. (90 Proof)",
        net_contents="750 mL",
        bottler="Bottled by Old Tom Distillery, Bardstown, KY",
        country="",
        warning_text=std_warning,
        warning_bold=True
    )
    
    # 2. Minor Casing/Punctuation Warnings
    generate_label(
        os.path.join(dest_dir, "stones_throw.png"),
        brand_name="STONE'S THROW",
        class_type="Dry Gin",
        abv_text="40% Alc./Vol.",
        net_contents="1 L",
        bottler="Distilled & Bottled by Stone's Throw Co., Portland, OR",
        country="",
        warning_text=std_warning,
        warning_bold=True
    )
    
    # 3. Non-compliant casing (prefix is Title Case)
    non_caps_warning = std_warning.replace("GOVERNMENT WARNING:", "Government Warning:")
    generate_label(
        os.path.join(dest_dir, "highland_mist.png"),
        brand_name="HIGHLAND MIST",
        class_type="Single Malt Scotch Whisky",
        abv_text="43% Alc./Vol.",
        net_contents="700 mL",
        bottler="Imported by Highland Imports, New York, NY",
        country="Product of Scotland",
        warning_text=non_caps_warning,
        warning_bold=True
    )
    
    # 4. Non-compliant typo in surgeon general text
    typo_warning = std_warning.replace("Surgeon General", "Sergeon General")
    generate_label(
        os.path.join(dest_dir, "el_dorado.png"),
        brand_name="EL DORADO",
        class_type="Tequila Reposado",
        abv_text="40% Alc./Vol.",
        net_contents="750 mL",
        bottler="Imported by El Dorado Spirits, Houston, TX",
        country="Product of Mexico",
        warning_text=typo_warning,
        warning_bold=True
    )
    
    # 5. ABV Mismatch
    generate_label(
        os.path.join(dest_dir, "chateau_rouge.png"),
        brand_name="CHATEAU ROUGE",
        class_type="Red Wine",
        abv_text="14.5% Alc./Vol.", # Mismatches CSV's 13.5%
        net_contents="750 mL",
        bottler="Imported by Chateau Rouge USA, Napa, CA",
        country="Product of France",
        warning_text=std_warning,
        warning_bold=True
    )
    
    # Generate CSV file mapping
    csv_path = os.path.join(dest_dir, "cola_batch.csv")
    csv_rows = [
        ["filename", "brandName", "classType", "abv", "netContents", "bottlerNameAddress", "countryOfOrigin", "governmentWarning"],
        ["old_tom.png", "OLD TOM DISTILLERY", "Kentucky Straight Bourbon Whiskey", "45% Alc./Vol.", "750 mL", "Bottled by Old Tom Distillery, Bardstown, KY", "", ""],
        ["stones_throw.png", "Stone's Throw", "Dry Gin", "40% ABV", "1 L", "Distilled & Bottled by Stone's Throw Co., Portland, OR", "", ""],
        ["highland_mist.png", "HIGHLAND MIST", "Single Malt Scotch Whisky", "43% Alc./Vol.", "700 mL", "Imported by Highland Imports, New York, NY", "Product of Scotland", ""],
        ["el_dorado.png", "EL DORADO", "Tequila Reposado", "40% Alc./Vol.", "750 mL", "Imported by El Dorado Spirits, Houston, TX", "Product of Mexico", ""],
        ["chateau_rouge.png", "CHATEAU ROUGE", "Red Wine", "13.5% Alc./Vol.", "750 mL", "Imported by Chateau Rouge USA, Napa, CA", "Product of France", ""]
    ]
    
    with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(csv_rows)
    print(f"Generated CSV: {csv_path}")

if __name__ == "__main__":
    main()
