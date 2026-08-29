import { useState } from 'react';
import { useProjectStore } from '@store/projectStore';
import { QuickStartBar } from './QuickStartBar';
import { TemplateGallery } from './TemplateGallery';
import { RecentProjects } from './RecentProjects';
import { TutorialSection } from './TutorialSection';
import { DocsBrowser } from './DocsBrowser';
import { CordsBoxLogo } from '../common/CordsBoxLogo';
import { Button } from '../common/Button';
import { LayoutGrid, GraduationCap, BookOpen, ArrowRight } from 'lucide-react';

export type HomeTab = 'templates' | 'tutorials' | 'docs';

export function HomePage() {
  const [activeTab, setActiveTab] = useState<HomeTab>('templates');
  const navigateTo = useProjectStore((s) => s.navigateTo);

  const navTabs = [
    { id: 'templates' as const, label: 'Projects & Templates', icon: LayoutGrid },
    { id: 'tutorials' as const, label: 'Tutorials', icon: GraduationCap },
    { id: 'docs' as const, label: 'Documentation', icon: BookOpen },
  ];

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#121214',
        color: '#f4f4f5',
        overflowY: 'auto',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Navbar */}
      <header
        style={{
          width: '100%',
          backgroundColor: '#18181b',
          borderBottom: '1px solid #27272a',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            width: '100%',
            height: '64px',
            margin: '0 auto',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxSizing: 'border-box',
          }}
        >
          {/* Brand Logo & Version */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <CordsBoxLogo size={30} />
            <span style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
              Cords Box
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#d97706',
                backgroundColor: 'rgba(217, 119, 6, 0.12)',
                border: '1px solid rgba(217, 119, 6, 0.25)',
                padding: '2px 8px',
                borderRadius: '4px',
                lineHeight: '1.2',
              }}
            >
              v2.0
            </span>
          </div>

          {/* Concise 3-Tab Switcher */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: isActive ? '#27272a' : 'transparent',
                    color: isActive ? '#ffffff' : '#a1a1aa',
                    border: isActive ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid transparent',
                    borderRadius: '6px',
                    padding: '7px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={15} color={isActive ? '#38bdf8' : '#71717a'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Direct Studio Jump */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <Button
              variant="primary"
              onClick={() => navigateTo('editor')}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '6px',
                backgroundColor: '#dc2626',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 10px rgba(220, 38, 38, 0.35)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>Open Studio Workbench</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '24px 20px 48px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxSizing: 'border-box',
        }}
      >
        {activeTab === 'templates' && (
          <>
            <QuickStartBar />
            <RecentProjects />
            <TemplateGallery />
          </>
        )}

        {activeTab === 'tutorials' && <TutorialSection />}

        {activeTab === 'docs' && <DocsBrowser />}
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          textAlign: 'center',
          fontSize: '11.5px',
          color: '#52525b',
        }}
      >
        Cords Box — Virtual Guitar Wiring Harness & Wave Digital Filter Audio Workbench
      </footer>
    </div>
  );
}
