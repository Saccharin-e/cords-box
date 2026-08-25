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
          height: '64px',
          backgroundColor: '#18181b',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              padding: '2px 7px',
              borderRadius: '4px',
            }}
          >
            v2.0
          </span>
        </div>

        {/* Concise 3-Tab Switcher */}
        <nav
          style={{
            display: 'flex',
            gap: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
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
                  padding: '7px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} color={isActive ? '#38bdf8' : '#71717a'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Direct Studio Jump */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Button
            variant="primary"
            onClick={() => navigateTo('editor')}
            style={{
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: '6px',
              backgroundColor: '#dc2626',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(220, 38, 38, 0.35)',
            }}
          >
            <span>Open Studio Workbench</span>
            <ArrowRight size={13} />
          </Button>
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
