const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'c:\\Users\\cj john\\LH-CONNECT\\app\\(resident)\\dashboard\\submit-payment\\submit-payment.module.css',
    'c:\\Users\\cj john\\LH-CONNECT\\app\\(resident)\\dashboard\\contact-hoa\\contact-hoa.module.css',
    'c:\\Users\\cj john\\LH-CONNECT\\app\\(resident)\\dashboard\\view-statements\\view-statements.module.css'
];

const replacements = [
    // Inputs
    [
        /border:\s*1\.5px\s*solid\s*#e2e8f0;/g,
        "border: 2px solid transparent;\n  background-color: #f1f5f9;"
    ],
    [
        /border-color:\s*#2D3E6F;/g,
        "border-color: #3B8B8C;"
    ],
    [
        /box-shadow:\s*0\s*0\s*0\s*4px\s*rgba\(45,\s*62,\s*111,\s*0\.2\);/g,
        "box-shadow: 0 0 0 4px rgba(59, 139, 140, 0.15);\n  background-color: #ffffff;"
    ],
    
    // Cards & Forms (more premium look)
    [
        /background:\s*rgba\(255,\s*255,\s*255,\s*0\.75\);\s*backdrop-filter:\s*blur\(20px\);\s*-webkit-backdrop-filter:\s*blur\(20px\);/g,
        "background: rgba(255, 255, 255, 0.95);\n  backdrop-filter: blur(24px);\n  -webkit-backdrop-filter: blur(24px);"
    ],
    [
        /box-shadow:\s*0\s*10px\s*40px\s*-10px\s*rgba\(45,\s*62,\s*111,\s*0\.08\),\s*inset\s*0\s*1px\s*0\s*rgba\(255,\s*255,\s*255,\s*0\.8\);/g,
        "box-shadow: 0 12px 36px -8px rgba(45, 62, 111, 0.08), 0 4px 12px -4px rgba(45, 62, 111, 0.04), inset 0 1px 0 rgba(255, 255, 255, 1);"
    ],
    [
        /border:\s*1px\s*solid\s*rgba\(255,\s*255,\s*255,\s*0\.5\);\s*border-bottom:\s*1px\s*solid\s*rgba\(255,\s*255,\s*255,\s*0\.3\);\s*border-right:\s*1px\s*solid\s*rgba\(255,\s*255,\s*255,\s*0\.3\);/g,
        "border: 1px solid rgba(45, 62, 111, 0.06);\n  border-top: 1px solid rgba(255, 255, 255, 0.8);"
    ],
    
    // Modern gradients for primary buttons/headers
    [
        /background:\s*#2D3E6F;/g,
        "background: linear-gradient(135deg, #1B2A4A 0%, #2D3E6F 100%);"
    ],
    [
        /background:\s*linear-gradient\(135deg,\s*#2D3E6F\s*0%,\s*#3B8B8C\s*100%\);/g,
        "background: linear-gradient(135deg, #2D3E6F 0%, #3B8B8C 100%);\n  background-size: 200% auto;\n  animation: gradientShift 4s ease infinite;"
    ],
    
    // Headings
    [
        /font-weight:\s*800;/g,
        "font-weight: 800;\n  letter-spacing: -0.03em;"
    ],
    
    // Backgrounds
    [
        /background:\s*linear-gradient\(135deg,\s*#F8F9FC\s*0%,\s*#F0F4F8\s*50%,\s*#E2E8F0\s*100%\);/g,
        "background: #F8F9FC;\n  background-image: \n    radial-gradient(at 0% 0%, rgba(59, 139, 140, 0.06) 0px, transparent 50%),\n    radial-gradient(at 100% 0%, rgba(45, 62, 111, 0.06) 0px, transparent 50%),\n    radial-gradient(at 100% 100%, rgba(59, 139, 140, 0.06) 0px, transparent 50%),\n    radial-gradient(at 0% 100%, rgba(45, 62, 111, 0.06) 0px, transparent 50%);"
    ],
    
    // Tables (View statements)
    [
        /border-bottom:\s*1px\s*solid\s*rgba\(45,\s*62,\s*111,\s*0\.12\);/g,
        "border-bottom: 1px solid rgba(45, 62, 111, 0.05);"
    ],
    [
        /background:\s*#F8F9FC;/g,
        "background: #F8FAFC;"
    ]
];

for (const fullPath of filesToUpdate) {
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let newContent = content;
        
        for (const [regex, repl] of replacements) {
            newContent = newContent.replace(regex, repl);
        }
        
        // Add gradient animation keyframes if not present and if linear-gradient animation is added
        if (newContent.includes('animation: gradientShift') && !newContent.includes('@keyframes gradientShift')) {
            newContent += "\n\n@keyframes gradientShift {\n  0% { background-position: 0% 50%; }\n  50% { background-position: 100% 50%; }\n  100% { background-position: 0% 50%; }\n}\n";
        }
        
        if (newContent !== content) {
            fs.writeFileSync(fullPath, newContent, 'utf8');
            console.log(`Updated ${fullPath}`);
        }
    } else {
        console.log(`File not found: ${fullPath}`);
    }
}
console.log("Done.");
