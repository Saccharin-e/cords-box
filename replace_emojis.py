import os, re

files_with_x = [
    'src/ui/inspector/ValueInspector.tsx',
    'src/ui/toolbar/PlayableFretboardPanel.tsx',
    'src/ui/toolbar/AmpPedalboardPanel.tsx',
    'src/ui/toolbar/GuitarSoundTestPanel.tsx',
    'src/ui/tab/TabPanel.tsx',
    'src/ui/canvas/WireOptionsPanel.tsx',
    'src/ui/library/ComponentLibrary.tsx',
    'src/ui/settings/LayoutSlotsModal.tsx',
    'src/ui/export/ExportModal.tsx'
]

for filepath in files_with_x:
    if not os.path.exists(filepath): continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if 'lucide-react' is already imported
    has_lucide = 'lucide-react' in content
    
    # Find all unique imports from lucide-react if any
    lucide_imports = set()
    if has_lucide:
        m = re.search(r"import\s+\{([^}]+)\}\s+from\s+['\"]lucide-react['\"]", content)
        if m:
            lucide_imports.update([i.strip() for i in m.group(1).split(',') if i.strip()])
    
    modified = False
    if '✕' in content:
        content = content.replace('✕', '<X size={14} />')
        lucide_imports.add('X')
        modified = True

    if '✓' in content:
        content = content.replace('✓', '<Check size={14} />')
        lucide_imports.add('Check')
        modified = True
    
    if modified:
        import_str = "import { " + ", ".join(sorted(lucide_imports)) + " } from 'lucide-react';"
        if has_lucide:
            content = re.sub(r"import\s+\{[^}]+\}\s+from\s+['\"]lucide-react['\"];?", import_str, content)
        else:
            # Find the last import statement and add it there
            last_import = 0
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('import '):
                    last_import = i
            lines.insert(last_import + 1, import_str)
            content = '\n'.join(lines)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

