import { Toolbar } from './ui/toolbar/Toolbar';
import { ComponentLibrary } from './ui/library/ComponentLibrary';
import { DualCanvas } from './ui/canvas/DualCanvas';
import { ValueInspector } from './ui/inspector/ValueInspector';

export default function App() {
  return (
    <div className="app-layout" id="app-root">
      <Toolbar />
      <ComponentLibrary />
      <DualCanvas />
      <ValueInspector />
    </div>
  );
}
