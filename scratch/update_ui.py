import os
import re

resident_dir = r"c:\Users\cj john\LH-CONNECT\app\(resident)"

replacements = [
    # Card Backgrounds -> Glassmorphism
    (r"background:\s*rgba\(255,\s*255,\s*255,\s*0\.9[0-9]\);", 
     "background: rgba(255, 255, 255, 0.75);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);"),
    
    # Borders -> Soft glass borders
    (r"border:\s*1px\s*solid\s*rgba\(45,\s*62,\s*111,\s*0\.1[0-9]\);", 
     "border: 1px solid rgba(255, 255, 255, 0.5);\n  border-bottom: 1px solid rgba(255, 255, 255, 0.3);\n  border-right: 1px solid rgba(255, 255, 255, 0.3);"),

    # Container backgrounds (make them more modern/subtle gradients)
    (r"background:\s*linear-gradient\(180deg,\s*#F8F9FC\s*0%,\s*rgba\(59,\s*139,\s*140,\s*0\.06\)\s*50%,\s*#F8F9FC\s*100%\);",
     "background: linear-gradient(135deg, #F8F9FC 0%, #F0F4F8 50%, #E2E8F0 100%);"),
    (r"background:\s*radial-gradient\(circle\s*at\s*20%\s*50%,\s*rgba\(45,\s*62,\s*111,\s*0\.08\)\s*0%,\s*transparent\s*50%\),\s*radial-gradient\(circle\s*at\s*80%\s*80%,\s*rgba\(59,\s*139,\s*140,\s*0\.06\)\s*0%,\s*transparent\s*50%\);",
     "background:\n    radial-gradient(circle at 15% 30%, rgba(45, 62, 111, 0.05) 0%, transparent 40%),\n    radial-gradient(circle at 85% 70%, rgba(59, 139, 140, 0.05) 0%, transparent 40%),\n    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.4) 0%, transparent 60%);"),
    
    # Box shadows -> softer, more modern
    (r"box-shadow:\s*0\s*8px\s*24px\s*rgba\(45,\s*62,\s*111,\s*0\.1\);",
     "box-shadow: 0 10px 40px -10px rgba(45, 62, 111, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);"),
    (r"box-shadow:\s*0\s*12px\s*28px\s*rgba\(45,\s*62,\s*111,\s*0\.12\);",
     "box-shadow: 0 14px 45px -12px rgba(45, 62, 111, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8);"),
     
    # Buttons -> Neater, slightly pill shaped and subtle shadow
    (r"border-radius:\s*12px;", "border-radius: 14px;"),
    (r"border-radius:\s*10px;", "border-radius: 12px;"),
    
    # Add subtle transition to items
    (r"transition:\s*all\s*0\.35s\s*cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\);", 
     "transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);"),
    (r"transition:\s*all\s*0\.25s\s*ease;", 
     "transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);"),
    
    # Header glass
    (r"background:\s*rgba\(255,\s*255,\s*255,\s*0\.88\);",
     "background: rgba(255, 255, 255, 0.7);\n  backdrop-filter: blur(24px);\n  -webkit-backdrop-filter: blur(24px);"),
]

def update_css(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for pattern, repl in replacements:
        new_content = re.sub(pattern, repl, new_content)
        
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(resident_dir):
    for file in files:
        if file.endswith('.module.css'):
            update_css(os.path.join(root, file))

print("Done updating CSS.")
