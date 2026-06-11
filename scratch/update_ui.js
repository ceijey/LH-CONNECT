const fs = require('fs');
const path = require('path');

const residentDir = path.join(__dirname, '..', 'app', '(resident)');

const replacements = [
    [
        /background:\s*rgba\(255,\s*255,\s*255,\s*0\.9[0-9]\);/g, 
        "background: rgba(255, 255, 255, 0.75);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);"
    ],
    [
        /border:\s*1px\s*solid\s*rgba\(45,\s*62,\s*111,\s*0\.1[0-9]\);/g, 
        "border: 1px solid rgba(255, 255, 255, 0.5);\n  border-bottom: 1px solid rgba(255, 255, 255, 0.3);\n  border-right: 1px solid rgba(255, 255, 255, 0.3);"
    ],
    [
        /background:\s*linear-gradient\(180deg,\s*#F8F9FC\s*0%,\s*rgba\(59,\s*139,\s*140,\s*0\.06\)\s*50%,\s*#F8F9FC\s*100%\);/g,
        "background: linear-gradient(135deg, #F8F9FC 0%, #F0F4F8 50%, #E2E8F0 100%);"
    ],
    [
        /background:\s*radial-gradient\(circle\s*at\s*20%\s*50%,\s*rgba\(45,\s*62,\s*111,\s*0\.08\)\s*0%,\s*transparent\s*50%\),\s*radial-gradient\(circle\s*at\s*80%\s*80%,\s*rgba\(59,\s*139,\s*140,\s*0\.06\)\s*0%,\s*transparent\s*50%\);/g,
        "background:\n    radial-gradient(circle at 15% 30%, rgba(45, 62, 111, 0.05) 0%, transparent 40%),\n    radial-gradient(circle at 85% 70%, rgba(59, 139, 140, 0.05) 0%, transparent 40%),\n    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.4) 0%, transparent 60%);"
    ],
    [
        /box-shadow:\s*0\s*8px\s*24px\s*rgba\(45,\s*62,\s*111,\s*0\.1\);/g,
        "box-shadow: 0 10px 40px -10px rgba(45, 62, 111, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);"
    ],
    [
        /box-shadow:\s*0\s*12px\s*28px\s*rgba\(45,\s*62,\s*111,\s*0\.12\);/g,
        "box-shadow: 0 14px 45px -12px rgba(45, 62, 111, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8);"
    ],
    [
        /border-radius:\s*12px;/g, "border-radius: 14px;"
    ],
    [
        /border-radius:\s*10px;/g, "border-radius: 12px;"
    ],
    [
        /transition:\s*all\s*0\.35s\s*cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\);/g, 
        "transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);"
    ],
    [
        /transition:\s*all\s*0\.25s\s*ease;/g, 
        "transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);"
    ],
    [
        /background:\s*rgba\(255,\s*255,\s*255,\s*0\.88\);/g,
        "background: rgba(255, 255, 255, 0.7);\n  backdrop-filter: blur(24px);\n  -webkit-backdrop-filter: blur(24px);"
    ]
];

function updateCssFiles(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            updateCssFiles(fullPath);
        } else if (file.endsWith('.module.css')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let newContent = content;
            
            for (const [regex, repl] of replacements) {
                newContent = newContent.replace(regex, repl);
            }
            
            if (newContent !== content) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

updateCssFiles(residentDir);
console.log("Done.");
