import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Database,
  Eye,
  FileText,
  Filter,
  GitBranch,
  Layers,
  Maximize2,
  Minimize2,
  Network,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { Badge, Button, Card, Notice } from '@/components/ui';
import { LoadDemoButton } from '@/components/documents/LoadDemoButton';
import { apiGetGraph } from '@/lib/api/knowledge';
import { checkBackendHealth } from '@/lib/api/client';
import { cn } from '@/lib/cn';

type NodeType = 'concept' | 'entity' | 'topic' | 'reference';

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  docTitle: string;
  x: number;
  y: number;
  radius: number;
  connections: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

// Curated interactive graph data aligned with demo documents (municipal, commercial lease, guidelines)
const INITIAL_NODES: GraphNode[] = [
  { id: '1', label: 'Trade License', type: 'concept', docTitle: 'Municipal_Act_2024.pdf', x: 260, y: 160, radius: 24, connections: ['2', '3', '5'] },
  { id: '2', label: 'Commercial Lease', type: 'concept', docTitle: 'Commercial_Lease_Agreement.pdf', x: 420, y: 130, radius: 26, connections: ['1', '4', '6'] },
  { id: '3', label: 'Annual Renewal', type: 'topic', docTitle: 'Municipal_Act_2024.pdf', x: 160, y: 270, radius: 20, connections: ['1', '7'] },
  { id: '4', label: 'Landlord Consent', type: 'reference', docTitle: 'Commercial_Lease_Agreement.pdf', x: 550, y: 220, radius: 19, connections: ['2', '8'] },
  { id: '5', label: 'Section 4.2', type: 'reference', docTitle: 'Commercial_Lease_Agreement.pdf', x: 330, y: 280, radius: 18, connections: ['1', '2'] },
  { id: '6', label: 'Late Fee Assessment', type: 'entity', docTitle: 'Municipal_Act_2024.pdf', x: 480, y: 320, radius: 21, connections: ['2', '7'] },
  { id: '7', label: '31 March Deadline', type: 'entity', docTitle: 'Municipal_Act_2024.pdf', x: 220, y: 390, radius: 22, connections: ['3', '6'] },
  { id: '8', label: 'Tenant Improvements', type: 'topic', docTitle: 'Commercial_Lease_Agreement.pdf', x: 620, y: 340, radius: 20, connections: ['4'] },
  { id: '9', label: 'Arbitration Jurisdiction', type: 'reference', docTitle: 'Commercial_Guidelines.docx', x: 380, y: 410, radius: 19, connections: ['6'] },
];

const INITIAL_EDGES: GraphEdge[] = [
  { source: '1', target: '2', relation: 'regulates' },
  { source: '1', target: '3', relation: 'requires' },
  { source: '1', target: '5', relation: 'mandated_by' },
  { source: '2', target: '4', relation: 'stipulates' },
  { source: '2', target: '5', relation: 'references' },
  { source: '2', target: '6', relation: 'enforces' },
  { source: '3', target: '7', relation: 'deadline_at' },
  { source: '4', target: '8', relation: 'governs' },
  { source: '6', target: '7', relation: 'penalizes_past' },
  { source: '6', target: '9', relation: 'subject_to' },
];

const NODE_COLORS: Record<NodeType, { fill: string; stroke: string; text: string; badgeTone: 'green' | 'cyan' | 'purple' | 'orange' }> = {
  concept: { fill: '#53B54F', stroke: '#3e983b', text: '#255024', badgeTone: 'green' },
  entity: { fill: '#14F6FA', stroke: '#00adb5', text: '#0c6a71', badgeTone: 'cyan' },
  topic: { fill: '#C6A9D8', stroke: '#8c62aa', text: '#4f355f', badgeTone: 'purple' },
  reference: { fill: '#F09B04', stroke: '#d27c02', text: '#6e3b0e', badgeTone: 'orange' },
};

export function KnowledgeGraphPage() {
  const { t } = useTranslation();
  const { documents } = useLibrary();
  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<GraphEdge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(INITIAL_NODES[0]);
  const [activeFilter, setActiveFilter] = useState<NodeType | 'all'>('all');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isBackendLoaded, setIsBackendLoaded] = useState(false);

  useEffect(() => {
    async function loadLiveGraph() {
      try {
        const health = await checkBackendHealth();
        if (!health.reachable) return;
        const res = await apiGetGraph(undefined, 40);
        if (res.nodes && res.nodes.length > 0) {
          // Compute circular/force coordinates for live nodes
          const width = 800;
          const height = 500;
          const centerX = width / 2;
          const centerY = height / 2;
          const radius = 180;

          const liveNodes: GraphNode[] = res.nodes.map((n, i) => {
            const angle = (2 * Math.PI * i) / res.nodes.length;
            const r = n.node_type === 'concept' ? radius : radius * 0.75 + (i % 2 === 0 ? 40 : -40);
            const x = Math.max(80, Math.min(width - 80, centerX + r * Math.cos(angle)));
            const y = Math.max(80, Math.min(height - 80, centerY + r * Math.sin(angle)));
            const type = (['concept', 'entity', 'topic', 'reference'].includes(n.node_type)
              ? n.node_type
              : 'concept') as NodeType;
            return {
              id: n.id,
              label: n.label,
              type,
              docTitle: (n.metadata_?.file_type as string) ? `Indexed Document (${n.metadata_.file_type})` : 'Knowledge Document',
              x,
              y,
              radius: type === 'concept' ? 24 : 19,
              connections: [],
            };
          });

          const liveEdges: GraphEdge[] = res.edges.map((e) => ({
            source: e.source_id,
            target: e.target_id,
            relation: e.relation || 'relates_to',
          }));

          setNodes(liveNodes);
          setEdges(liveEdges);
          setSelectedNode(liveNodes[0]);
          setIsBackendLoaded(true);
        }
      } catch (e) {
        console.warn('Could not load live backend knowledge graph, using curated dataset.', e);
      }
    }
    void loadLiveGraph();
  }, []);

  const filteredNodes = useMemo(() => {
    return activeFilter === 'all' ? nodes : nodes.filter((n) => n.type === activeFilter);
  }, [activeFilter, nodes]);

  const activeNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const visibleEdges = useMemo(() => {
    return edges.filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
  }, [activeNodeIds, edges]);

  const selectedConnections = useMemo(() => {
    if (!selectedNode) return [];
    return edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).map((e) => {
      const otherId = e.source === selectedNode.id ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return {
        id: otherId,
        label: otherNode?.label || otherId,
        type: otherNode?.type || 'concept',
        relation: e.relation,
        isOutgoing: e.source === selectedNode.id,
      };
    });
  }, [selectedNode, edges, nodes]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
              <Network className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-accent-700">
              Semantic Entity Network
            </span>
          </div>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900">Knowledge Graph</h2>
          <p className="max-w-2xl text-sm text-ink-500">
            Interactive visualization of extracted concepts, entities, and cross-document dependencies.
          </p>
        </div>

        {/* Legend pills with exact palette */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-bold transition',
              activeFilter === 'all' ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 text-ink-600',
            )}
          >
            All Types ({nodes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('concept')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              activeFilter === 'concept' ? 'bg-primary-600 text-white shadow-soft' : 'bg-primary-50 text-primary-800 border border-primary-200',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-brand-green" />
            Concept
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('entity')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              activeFilter === 'entity' ? 'bg-secondary-600 text-white shadow-soft' : 'bg-secondary-50 text-secondary-800 border border-secondary-200',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-brand-cyan" />
            Entity
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('topic')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              activeFilter === 'topic' ? 'bg-accent-600 text-white shadow-soft' : 'bg-lavender-100 text-accent-900 border border-accent-200',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-brand-purple" />
            Topic
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('reference')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              activeFilter === 'reference' ? 'bg-warm-600 text-white shadow-soft' : 'bg-warm-50 text-warm-800 border border-warm-200',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-brand-orange" />
            Reference
          </button>
        </div>
      </div>

      {/* ── Stat Banner ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4.5 border-ink-200">
          <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400">Indexed Sources</p>
          <p className="text-xl font-bold text-ink-900 mt-1">{documents.length > 0 ? documents.length : 3} Documents</p>
        </Card>
        <Card className="p-4.5 border-ink-200">
          <p className="text-[10px] uppercase font-bold tracking-wider text-primary-700">Concepts Extracted</p>
          <p className="text-xl font-bold text-primary-800 mt-1">{INITIAL_NODES.length} Nodes</p>
        </Card>
        <Card className="p-4.5 border-ink-200">
          <p className="text-[10px] uppercase font-bold tracking-wider text-secondary-700">Semantic Links</p>
          <p className="text-xl font-bold text-secondary-800 mt-1">{INITIAL_EDGES.length} Relations</p>
        </Card>
        <Card className="p-4.5 border-ink-200">
          <p className="text-[10px] uppercase font-bold tracking-wider text-accent-700">Cluster Density</p>
          <p className="text-xl font-bold text-accent-800 mt-1">High (4 Groups)</p>
        </Card>
      </div>

      {/* ── Main Interactive Canvas & Inspector Split ── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Interactive SVG Canvas */}
        <div className="relative rounded-3xl border border-ink-200 bg-white shadow-soft p-2 overflow-hidden lg:col-span-8 flex flex-col justify-between">
          {/* Canvas Toolbar */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <span className="rounded-xl bg-white/90 px-3 py-1 text-xs font-bold text-ink-700 border border-ink-200 shadow-soft backdrop-blur">
              Interactive Canvas (Click any node)
            </span>
          </div>

          <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-xl bg-white/90 p-1 border border-ink-200 shadow-soft backdrop-blur">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.6))}
              className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-100 transition"
              title="Zoom In"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.7))}
              className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-100 transition"
              title="Zoom Out"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-100 transition"
              title="Reset Zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* SVG Viewport */}
          <div className="h-[28rem] sm:h-[32rem] w-full overflow-hidden flex items-center justify-center">
            <svg
              viewBox="0 0 760 480"
              className="h-full w-full select-none cursor-grab active:cursor-grabbing transition-transform duration-300"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <defs>
                <marker
                  id="edge-arrow"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#cbd5e1" />
                </marker>
              </defs>

              {/* Background Grid Pattern */}
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#e2e8f0" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" opacity="0.7" />

              {/* Connecting Edges */}
              {visibleEdges.map((edge) => {
                const sourceNode = INITIAL_NODES.find((n) => n.id === edge.source);
                const targetNode = INITIAL_NODES.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const isConnectedToSelected =
                  selectedNode && (selectedNode.id === edge.source || selectedNode.id === edge.target);
                const isHovered =
                  hoveredNode && (hoveredNode === edge.source || hoveredNode === edge.target);

                return (
                  <g key={`${edge.source}-${edge.target}`}>
                    <line
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke={isConnectedToSelected || isHovered ? '#00adb5' : '#cbd5e1'}
                      strokeWidth={isConnectedToSelected || isHovered ? 2.5 : 1.5}
                      strokeDasharray={edge.relation.includes('deadline') ? '4 3' : undefined}
                      markerEnd="url(#edge-arrow)"
                      className="transition duration-200"
                    />
                    {/* Edge Label Pill */}
                    <text
                      x={(sourceNode.x + targetNode.x) / 2}
                      y={(sourceNode.y + targetNode.y) / 2 - 4}
                      textAnchor="middle"
                      className="fill-slate-500 font-bold"
                      style={{ fontSize: '9px' }}
                    >
                      {edge.relation}
                    </text>
                  </g>
                );
              })}

              {/* Nodes */}
              {filteredNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNode === node.id;
                const color = NODE_COLORS[node.type];

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer transition duration-200"
                  >
                    {/* Pulsing ring for selected node */}
                    {isSelected && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.radius + 8}
                        fill="none"
                        stroke={color.fill}
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                        className="animate-spin"
                        style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDuration: '8s' }}
                      />
                    )}

                    {/* Node Body Circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.radius}
                      fill={color.fill}
                      stroke={isSelected ? '#0f172a' : 'white'}
                      strokeWidth={isSelected ? 3 : 2}
                      className="transition-transform duration-200 hover:scale-110 drop-shadow-md"
                    />

                    {/* Node Text Label */}
                    <text
                      x={node.x}
                      y={node.y + node.radius + 14}
                      textAnchor="middle"
                      className="fill-ink-900 font-extrabold text-[11px] drop-shadow-sm select-none"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="p-3 border-t border-ink-100 flex items-center justify-between text-xs text-ink-400">
            <span>Showing {filteredNodes.length} nodes · {visibleEdges.length} connections</span>
            <span className="flex items-center gap-1 text-primary-700 font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Real-time Cross-Link Engine
            </span>
          </div>
        </div>

        {/* ── Node Detail Inspector (Right Column) ── */}
        <div className="space-y-4 lg:col-span-4">
          <Card className="p-6 border-ink-200 shadow-soft h-full flex flex-col justify-between">
            {selectedNode ? (
              <div className="space-y-5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-ink-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: NODE_COLORS[selectedNode.type].fill }}
                    />
                    <Badge tone={NODE_COLORS[selectedNode.type].badgeTone}>
                      {selectedNode.type.toUpperCase()}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-ink-400 font-bold uppercase">Node #{selectedNode.id}</span>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-ink-900">{selectedNode.label}</h3>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
                    <FileText className="h-3.5 w-3.5 text-secondary-600" />
                    <span className="truncate">{selectedNode.docTitle}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-ink-50 p-4 border border-ink-100 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Node Insights</p>
                  <p className="text-xs leading-relaxed text-ink-700">
                    Extracted from passage context. Forms a multi-document dependency bridge linking compliance deadlines with contract covenants.
                  </p>
                </div>

                {/* Connected Relationships List */}
                <div className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
                    Connected Relations ({selectedConnections.length})
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedConnections.map((conn) => (
                      <div
                        key={conn.id}
                        onClick={() => {
                          const target = INITIAL_NODES.find((n) => n.id === conn.id);
                          if (target) setSelectedNode(target);
                        }}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-ink-200/80 bg-white hover:bg-ink-50 cursor-pointer transition text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-ink-900 truncate">{conn.label}</span>
                        </div>
                        <span className="text-[10px] font-bold text-secondary-700 bg-secondary-100 px-2 py-0.5 rounded">
                          {conn.relation}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-xs text-ink-400">
                <Network className="h-10 w-10 text-ink-300 mb-3" />
                Select any node on the graph canvas to inspect relationships and source passages.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
