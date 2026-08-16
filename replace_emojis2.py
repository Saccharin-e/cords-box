import os, re

replacements = {
    'src/ui/inspector/ValueInspector.tsx': [
        ('🔒', '<Lock size={14} />', ['Lock']),
        ('🔓', '<Unlock size={14} />', ['Unlock']),
        ('➔', '<ArrowRight size={14} />', ['ArrowRight'])
    ],
    'src/ui/inspector/WiringDiagnosticsPanel.tsx': [
        ('✓', '<Check size={14} />', ['Check'])
    ],
    'src/ui/toolbar/GuitarSoundTestPanel.tsx': [
        ('📊', '<BarChart2 size={14} />', ['BarChart2']),
        ('🔊', '<Volume2 size={14} />', ['Volume2'])
    ],
    'src/ui/tab/TabPanel.tsx': [
        ('🎼', '<Music size={15} />', ['Music']),
        ('✏️', '<Edit2 size={14} />', ['Edit2']),
        ('✏', '<Edit2 size={14} />', ['Edit2']),
        ('⏱', '<Timer size={14} />', ['Timer']),
        ('📥', '<Download size={14} />', ['Download']),
        ('📤', '<Upload size={14} />', ['Upload']),
        ('🎸 ', '', []),
        ('🎷 ', '', []),
        ('⚡ ', '', []),
        ('✨ ', '', []),
        ('🎶 ', '', [])
    ],
    'src/ui/settings/LayoutSlotsModal.tsx': [
        ('✏️', '<Edit2 size={14} />', ['Edit2']),
        ('✏', '<Edit2 size={14} />', ['Edit2']),
        ('📦', '<Package size={14} />', ['Package']),
        ('⚡', '<Zap size={14} />', ['Zap'])
    ]
}

for filepath, reps in replacements.items():
    if not os.path.exists(filepath): continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    has_lucide = 'lucide-react' in content
    lucide_imports = set()
    if has_lucide:
        m = re.search(r"import\s+\{([^}]+)\}\s+from\s+['\"]lucide-react['\"]", content)
        if m:
            lucide_imports.update([i.strip() for i in m.group(1).split(',') if i.strip()])
    
    modified = False
    for old, new, imports in reps:
        if old in content:
            content = content.replace(old, new)
            lucide_imports.update(imports)
            modified = True
            
    if modified and lucide_imports:
        import_str = "import { " + ", ".join(sorted(lucide_imports)) + " } from 'lucide-react';"
        if has_lucide:
            content = re.sub(r"import\s+\{[^}]+\}\s+from\s+['\"]lucide-react['\"];?", import_str, content)
        else:
            last_import = 0
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('import '):
                    last_import = i
            lines.insert(last_import + 1, import_str)
            content = '\n'.join(lines)
            
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

