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
  Scale,
  Search,
  Share2,
  Shield,
  Sparkles,
  Tag,
  Target,
  Workflow,
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
type LayoutMode = 'tree' | 'network';

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  docTitle: string;
  x: number;
  y: number;
  treeX: number;
  treeY: number;
  radius: number;
  connections: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

// Well-spaced hierarchical knowledge tree & network coordinates
const INITIAL_NODES: GraphNode[] = [
  // Tier 1: Root Concept Documents & Charters (y=70)
  {
    id: '1',
    label: 'Municipal Bylaws Act',
    type: 'concept',
    docTitle: 'Municipal_Act_2024.pdf',
    x: 230,
    y: 90,
    treeX: 230,
    treeY: 70,
    radius: 22,
    connections: ['3', '5'],
  },
  {
    id: '2',
    label: 'Commercial Lease Code',
    type: 'concept',
    docTitle: 'Commercial_Lease_Agreement.pdf',
    x: 530,
    y: 80,
    treeX: 530,
    treeY: 70,
    radius: 22,
    connections: ['4', '5', '6'],
  },

  // Tier 2: Governance Clauses & Provisions (y=210)
  {
    id: '3',
    label: 'Trade License Mandate',
    type: 'topic',
    docTitle: 'Municipal_Act_2024.pdf',
    x: 130,
    y: 220,
    treeX: 130,
    treeY: 210,
    radius: 20,
    connections: ['1', '7'],
  },
  {
    id: '5',
    label: 'Section 4.2 Use Clause',
    type: 'reference',
    docTitle: 'Commercial_Lease_Agreement.pdf',
    x: 290,
    y: 220,
    treeX: 290,
    treeY: 210,
    radius: 19,
    connections: ['1', '2', '9'],
  },
  {
    id: '4',
    label: 'Landlord Prior Consent',
    type: 'reference',
    docTitle: 'Commercial_Lease_Agreement.pdf',
    x: 470,
    y: 220,
    treeX: 470,
    treeY: 210,
    radius: 19,
    connections: ['2', '8'],
  },
  {
    id: '6',
    label: 'Late Fee Penalty Scale',
    type: 'entity',
    docTitle: 'Municipal_Act_2024.pdf',
    x: 630,
    y: 220,
    treeX: 630,
    treeY: 210,
    radius: 20,
    connections: ['2', '7', '10'],
  },

  // Tier 3: Operational Deadlines & Compliance Rules (y=350)
  {
    id: '7',
    label: '31 March Annual Deadline',
    type: 'entity',
    docTitle: 'Municipal_Act_2024.pdf',
    x: 130,
    y: 350,
    treeX: 130,
    treeY: 350,
    radius: 20,
    connections: ['3', '6'],
  },
  {
    id: '9',
    label: 'Arbitration Jurisdiction',
    type: 'reference',
    docTitle: 'Commercial_Guidelines.docx',
    x: 300,
    y: 350,
    treeX: 300,
    treeY: 350,
    radius: 19,
    connections: ['5'],
  },
  {
    id: '8',
    label: 'Tenant Alteration Standard',
    type: 'topic',
    docTitle: 'Commercial_Lease_Agreement.pdf',
    x: 470,
    y: 350,
    treeX: 470,
    treeY: 350,
    radius: 19,
    connections: ['4'],
  },
  {
    id: '10',
    label: 'Dispute & Eviction Notice',
    type: 'entity',
    docTitle: 'Commercial_Lease_Agreement.pdf',
    x: 630,
    y: 350,
    treeX: 630,
    treeY: 350,
    radius: 19,
    connections: ['6'],
  },
];

const INITIAL_EDGES: GraphEdge[] = [
  { source: '1', target: '3', relation: 'mandates' },
  { source: '1', target: '5', relation: 'regulates' },
  { source: '2', target: '5', relation: 'incorporates' },
  { source: '2', target: '4', relation: 'stipulates' },
  { source: '2', target: '6', relation: 'enforces' },
  { source: '3', target: '7', relation: 'deadline_at' },
  { source: '5', target: '9', relation: 'venue' },
  { source: '4', target: '8', relation: 'governs' },
  { source: '6', target: '7', relation: 'penalizes_past' },
  { source: '6', target: '10', relation: 'escalates_to' },
];

const NODE_COLORS: Record<
  NodeType,
  { fill: string; stroke: string; text: string; badgeTone: 'green' | 'cyan' | 'purple' | 'orange' }
> = {
  concept: { fill: '#0FA4AF', stroke: '#024950', text: '#003135', badgeTone: 'cyan' },
  entity: { fill: '#024950', stroke: '#003135', text: '#ffffff', badgeTone: 'green' },
  topic: { fill: '#AFDDE5', stroke: '#0FA4AF', text: '#024950', badgeTone: 'purple' },
  reference: { fill: '#964734', stroke: '#7d3828', text: '#ffffff', badgeTone: 'orange' },
};

export function KnowledgeGraphPage() {
  const { t } = useTranslation();
  const { documents } = useLibrary();
  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<GraphEdge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(INITIAL_NODES[0]);
  const [activeFilter, setActiveFilter] = useState<NodeType | 'all'>('all');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('tree');
  const [searchQuery, setSearchQuery] = useState('');
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
          const width = 760;
          const liveNodes: GraphNode[] = res.nodes.map((n, i) => {
            const isRoot = n.node_type === 'concept';
            const col = i % 4;
            const row = Math.floor(i / 4);
            const treeX = 120 + col * 170;
            const treeY = 70 + row * 130;
            const angle = (2 * Math.PI * i) / res.nodes.length;
            const radius = 170;
            const netX = width / 2 + radius * Math.cos(angle);
            const netY = 220 + radius * 0.7 * Math.sin(angle);
            const type = (['concept', 'entity', 'topic', 'reference'].includes(n.node_type)
              ? n.node_type
              : 'concept') as NodeType;
            return {
              id: n.id,
              label: n.label,
              type,
              docTitle: (n.metadata_?.file_type as string)
                ? `Indexed Document (${n.metadata_.file_type})`
                : 'Knowledge Document',
              x: netX,
              y: netY,
              treeX,
              treeY,
              radius: isRoot ? 22 : 19,
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
        console.warn('Could not load live backend knowledge graph, using curated tree dataset.', e);
      }
    }
    void loadLiveGraph();
  }, []);

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return nodes.filter((n) => {
      const matchesType = activeFilter === 'all' || n.type === activeFilter;
      const matchesQuery = !q || n.label.toLowerCase().includes(q) || n.docTitle.toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [activeFilter, searchQuery, nodes]);

  const activeNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const visibleEdges = useMemo(() => {
    return edges.filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
  }, [activeNodeIds, edges]);

  const selectedConnections = useMemo(() => {
    if (!selectedNode) return [];
    return edges
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .map((e) => {
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
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
              <Workflow className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-accent-700">
              Hierarchical Knowledge Tree & Entity Network
            </span>
          </div>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900">Knowledge Graph</h2>
          <p className="max-w-2xl text-sm text-ink-500">
            Structured conceptual relationships, compliance hierarchies, and cross-document statutory links.
          </p>
        </div>

        {/* Layout Mode & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-xl bg-ink-100 p-1 ring-1 ring-ink-200">
            <button
              type="button"
              onClick={() => setLayoutMode('tree')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition',
                layoutMode === 'tree' ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <GitBranch className="h-3.5 w-3.5 text-primary-600" />
              Hierarchical Tree
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('network')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition',
                layoutMode === 'network' ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <Network className="h-3.5 w-3.5 text-secondary-600" />
              Radial Network
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Bar & Search ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-bold transition',
              activeFilter === 'all' ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100',
            )}
          >
            All Types ({nodes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('concept')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              activeFilter === 'concept'
                ? 'bg-primary-600 text-white shadow-soft'
                : 'bg-primary-50 text-primary-800 border border-primary-200',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-brand-green" />
            Concept Acts
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('topic')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              activeFilter === 'topic'
                ? 'bg-accent-600 text-white shadow-soft'
                : 'bg-lavender-100 text-accent-900 border border-accent-200',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-brand-purple" />
            Topics
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('reference')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              activeFilter === 'reference'
                ? 'bg-warm-600 text-white shadow-soft'
                : 'bg-warm-50 text-warm-800 border border-warm-200',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-brand-orange" />
            Clauses
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('entity')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              activeFilter === 'entity'
                ? 'bg-secondary-600 text-white shadow-soft'
                : 'bg-secondary-50 text-secondary-800 border border-secondary-200',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-brand-cyan" />
            Rules & Deadlines
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search concepts or rules..."
            className="h-9 w-full rounded-xl border border-ink-200 bg-ink-50/50 pl-8.5 pr-3 text-xs text-ink-900 placeholder:text-ink-400 outline-none focus:border-secondary-500 focus:bg-white"
          />
        </div>
      </div>

      {/* ── Main Interactive Canvas & Inspector Split ── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Interactive SVG Canvas */}
        <div className="relative rounded-3xl border border-ink-200 bg-white shadow-soft p-2 overflow-hidden lg:col-span-8 flex flex-col justify-between">
          {/* Canvas Toolbar */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <span className="rounded-xl bg-white/95 px-3 py-1 text-xs font-bold text-ink-800 border border-ink-200 shadow-soft backdrop-blur flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
              {layoutMode === 'tree' ? 'Structured Tree Hierarchy' : 'Semantic Mesh'}
            </span>
          </div>

          <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-xl bg-white/95 p-1 border border-ink-200 shadow-soft backdrop-blur">
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
          <div className="h-[30rem] sm:h-[34rem] w-full overflow-hidden flex items-center justify-center bg-radial-pattern">
            <svg
              viewBox="0 0 760 450"
              className="h-full w-full select-none cursor-grab active:cursor-grabbing transition-transform duration-300"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <defs>
                <marker
                  id="edge-arrow"
                  viewBox="0 0 10 10"
                  refX="16"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
                <marker
                  id="edge-arrow-active"
                  viewBox="0 0 10 10"
                  refX="16"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0284c7" />
                </marker>
              </defs>

              {/* Background Tier Boundary Guides for Tree View */}
              {layoutMode === 'tree' && (
                <g className="opacity-40">
                  <line x1="40" y1="140" x2="720" y2="140" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x="50" y="132" className="fill-slate-400 font-bold text-[9px] uppercase tracking-wider">
                    Tier 1: Core Statutory Acts
                  </text>
                  <line x1="40" y1="280" x2="720" y2="280" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x="50" y="272" className="fill-slate-400 font-bold text-[9px] uppercase tracking-wider">
                    Tier 2: Governance Clauses & Mandates
                  </text>
                  <text x="50" y="420" className="fill-slate-400 font-bold text-[9px] uppercase tracking-wider">
                    Tier 3: Operational Rules & Deadlines
                  </text>
                </g>
              )}

              {/* Connecting Edges with Masked Pill Labels */}
              {visibleEdges.map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source);
                const targetNode = nodes.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const sx = layoutMode === 'tree' ? sourceNode.treeX : sourceNode.x;
                const sy = layoutMode === 'tree' ? sourceNode.treeY : sourceNode.y;
                const tx = layoutMode === 'tree' ? targetNode.treeX : targetNode.x;
                const ty = layoutMode === 'tree' ? targetNode.treeY : targetNode.y;

                const isConnected =
                  selectedNode && (selectedNode.id === edge.source || selectedNode.id === edge.target);
                const isHovered =
                  hoveredNode && (hoveredNode === edge.source || hoveredNode === edge.target);

                const midX = (sx + tx) / 2;
                const midY = (sy + ty) / 2;
                const labelText = edge.relation.replace('_', ' ');
                const labelWidth = Math.max(54, labelText.length * 6.5 + 14);

                // Smooth directional curve
                const pathD =
                  layoutMode === 'tree'
                    ? `M ${sx} ${sy + 10} C ${sx} ${(sy + ty) / 2}, ${tx} ${(sy + ty) / 2}, ${tx} ${ty - 10}`
                    : `M ${sx} ${sy} L ${tx} ${ty}`;

                return (
                  <g key={`${edge.source}-${edge.target}`} className="transition-all duration-300">
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isConnected || isHovered ? '#0284c7' : '#cbd5e1'}
                      strokeWidth={isConnected || isHovered ? 2.5 : 1.5}
                      strokeDasharray={edge.relation.includes('deadline') ? '4 3' : undefined}
                      markerEnd={isConnected || isHovered ? 'url(#edge-arrow-active)' : 'url(#edge-arrow)'}
                    />

                    {/* Edge Label Pill with Solid White Backdrop Mask */}
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-labelWidth / 2}
                        y={-9}
                        width={labelWidth}
                        height={18}
                        rx={5}
                        fill="#ffffff"
                        stroke={isConnected || isHovered ? '#0284c7' : '#e2e8f0'}
                        strokeWidth={isConnected || isHovered ? 1.5 : 1}
                        className="shadow-xs"
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        className={cn(
                          'font-extrabold uppercase select-none',
                          isConnected || isHovered ? 'fill-sky-800' : 'fill-slate-600',
                        )}
                        style={{ fontSize: '8.5px', letterSpacing: '0.04em' }}
                      >
                        {labelText}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Nodes with Protected Badge Backdrops */}
              {filteredNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNode === node.id;
                const color = NODE_COLORS[node.type];
                const nx = layoutMode === 'tree' ? node.treeX : node.x;
                const ny = layoutMode === 'tree' ? node.treeY : node.y;

                const labelWidth = Math.max(90, node.label.length * 6.2 + 16);

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer transition duration-200"
                  >
                    {/* Glowing outer halo for active selection */}
                    {isSelected && (
                      <circle
                        cx={nx}
                        cy={ny}
                        r={node.radius + 7}
                        fill="none"
                        stroke={color.fill}
                        strokeWidth="2.5"
                        strokeDasharray="4 3"
                        className="animate-spin"
                        style={{ transformOrigin: `${nx}px ${ny}px`, animationDuration: '10s' }}
                      />
                    )}

                    {/* Node Core Circle */}
                    <circle
                      cx={nx}
                      cy={ny}
                      r={node.radius}
                      fill={color.fill}
                      stroke={isSelected ? '#0f172a' : '#ffffff'}
                      strokeWidth={isSelected ? 3 : 2}
                      className="drop-shadow-md transition-transform duration-200 hover:scale-110"
                    />

                    {/* Node Center Icon Symbol */}
                    <g transform={`translate(${nx - 6}, ${ny - 6})`} className="pointer-events-none">
                      {node.type === 'concept' ? (
                        <FileText className="h-3 w-3 text-white" />
                      ) : node.type === 'entity' ? (
                        <Shield className="h-3 w-3 text-slate-900" />
                      ) : node.type === 'topic' ? (
                        <Tag className="h-3 w-3 text-purple-950" />
                      ) : (
                        <Scale className="h-3 w-3 text-white" />
                      )}
                    </g>

                    {/* Protected Pill Card for Node Label — Zero Text Clashing */}
                    <g transform={`translate(${nx}, ${ny + node.radius + 6})`}>
                      <rect
                        x={-labelWidth / 2}
                        y={0}
                        width={labelWidth}
                        height={20}
                        rx={6}
                        fill="#ffffff"
                        stroke={isSelected ? '#0f172a' : '#cbd5e1'}
                        strokeWidth={isSelected ? 1.8 : 1}
                        className="shadow-sm"
                      />
                      <text
                        x={0}
                        y={14}
                        textAnchor="middle"
                        className={cn(
                          'font-bold select-none text-[10.5px]',
                          isSelected ? 'fill-slate-950 font-extrabold' : 'fill-slate-800',
                        )}
                      >
                        {node.label}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="p-3 border-t border-ink-100 flex items-center justify-between text-xs text-ink-500">
            <span>
              Displaying {filteredNodes.length} nodes · {visibleEdges.length} relation edges
            </span>
            <span className="flex items-center gap-1 text-primary-700 font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Verified Semantic Schema
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
                  <span className="text-[10px] text-ink-400 font-bold uppercase">
                    Node #{selectedNode.id}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-ink-900">{selectedNode.label}</h3>
                  <p className="text-xs text-ink-500 mt-0.5">{selectedNode.docTitle}</p>
                </div>

                <div className="rounded-2xl border border-ink-100 bg-ink-50/70 p-4 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    Statutory Summary
                  </span>
                  <p className="text-xs text-ink-700 leading-relaxed">
                    Extracted from indexed knowledge corpus. Linked to{' '}
                    <strong>{selectedConnections.length}</strong> related governance articles,
                    provisions, and compliance timelines.
                  </p>
                </div>

                {/* Direct Connections List */}
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-ink-800 flex items-center gap-1.5">
                    <Share2 className="h-3.5 w-3.5 text-secondary-600" />
                    Direct Semantic Relationships ({selectedConnections.length})
                  </span>

                  {selectedConnections.length === 0 ? (
                    <p className="text-xs text-ink-400 italic">No direct edges for this node.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {selectedConnections.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-xl border border-ink-200/80 bg-white text-xs hover:border-secondary-300 transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: NODE_COLORS[c.type].fill }}
                            />
                            <span className="truncate font-semibold text-ink-800">{c.label}</span>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold text-secondary-700 bg-secondary-50 px-2 py-0.5 rounded-md border border-secondary-100">
                            {c.isOutgoing ? `→ ${c.relation}` : `← ${c.relation}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-ink-400 space-y-2">
                <Target className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-xs">Select any node on the canvas to inspect its semantic links.</p>
              </div>
            )}

            <div className="pt-4 border-t border-ink-100">
              <a href="#assistant" className="block">
                <Button size="sm" variant="secondary" className="w-full">
                  Query in Assistant
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
