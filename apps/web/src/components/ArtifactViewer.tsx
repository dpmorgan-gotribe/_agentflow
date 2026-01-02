import type { Artifact } from '../types';

interface ArtifactViewerProps {
  artifact: Artifact;
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  switch (artifact.type) {
    case 'mockup':
      return <MockupViewer artifact={artifact} />;

    case 'asset':
      return <CodeViewer artifact={artifact} language="css" />;

    case 'documentation':
      return <MarkdownViewer artifact={artifact} />;

    case 'source_file':
    case 'test_file':
    case 'config_file':
    case 'schema':
    case 'migration':
      return <CodeViewer artifact={artifact} />;

    default:
      return <CodeViewer artifact={artifact} />;
  }
}

/**
 * Renders HTML mockups in a sandboxed iframe
 */
function MockupViewer({ artifact }: { artifact: Artifact }) {
  if (!artifact.content) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        No content available
      </div>
    );
  }

  return (
    <iframe
      srcDoc={artifact.content}
      className="artifact-iframe"
      title={artifact.name}
      sandbox="allow-scripts"
    />
  );
}

/**
 * Renders code with syntax highlighting (basic)
 */
function CodeViewer({ artifact, language }: { artifact: Artifact; language?: string }) {
  if (!artifact.content) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        No content available
      </div>
    );
  }

  return (
    <pre className="p-4 text-xs text-text-secondary overflow-auto h-full font-mono bg-bg-secondary">
      <code className={language ? `language-${language}` : ''}>{artifact.content}</code>
    </pre>
  );
}

/**
 * Renders markdown content as HTML
 */
function MarkdownViewer({ artifact }: { artifact: Artifact }) {
  if (!artifact.content) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        No content available
      </div>
    );
  }

  return (
    <div className="p-4 prose max-w-none overflow-auto h-full">
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(artifact.content) }} />
    </div>
  );
}

/**
 * Simple markdown renderer (can be replaced with a library like marked or react-markdown)
 */
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.*$)/gim, '<h3 class="text-text-primary text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-text-primary text-lg font-semibold mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-text-primary text-xl font-bold mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-bg-tertiary p-3 rounded overflow-x-auto my-3"><code>$2</code></pre>')
    .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/\n/g, '<br />');
}
