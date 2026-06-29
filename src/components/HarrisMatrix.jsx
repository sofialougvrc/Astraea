import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';

export default function HarrisMatrix({ units, relationships, highlightedUnits, selectedUnitId, onSelectUnit }) {
  const svgRef = useRef(null);
  const unitMap = useMemo(() => new Map(units.map(unit => [unit.id, unit])), [units]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 760;
    const height = 560;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const nodes = units.map((unit, index) => ({
      ...unit,
      x: width / 2 + Math.sin(index * 0.9) * 170,
      y: 60 + index * 72,
    }));

    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const edges = relationships.map(edge => ({
      ...edge,
      sourceNode: nodeById.get(edge.source),
      targetNode: nodeById.get(edge.target),
    })).filter(edge => edge.sourceNode && edge.targetNode);

    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 21)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#d7b177');

    const graph = svg.append('g').attr('class', 'graph-layer');

    graph.selectAll('.edge')
      .data(edges)
      .join('path')
      .attr('class', edge => `edge ${edge.reversed ? 'edge-warning' : ''}`)
      .attr('d', edge => {
        const midY = (edge.sourceNode.y + edge.targetNode.y) / 2;
        return `M${edge.sourceNode.x},${edge.sourceNode.y + 22} C${edge.sourceNode.x + 80},${midY} ${edge.targetNode.x - 80},${midY} ${edge.targetNode.x},${edge.targetNode.y - 22}`;
      })
      .attr('marker-end', 'url(#arrow)');

    graph.selectAll('.edge-label')
      .data(edges)
      .join('text')
      .attr('class', 'edge-label')
      .attr('x', edge => (edge.sourceNode.x + edge.targetNode.x) / 2)
      .attr('y', edge => (edge.sourceNode.y + edge.targetNode.y) / 2 - 8)
      .text(edge => edge.type);

    const nodeGroups = graph.selectAll('.node')
      .data(nodes)
      .join('g')
      .attr('class', node => `node ${node.anomalous || highlightedUnits.includes(node.id) ? 'node-anomaly' : ''} ${selectedUnitId === node.id ? 'node-selected' : ''}`)
      .attr('transform', node => `translate(${node.x}, ${node.y})`)
      .style('cursor', 'pointer')
      .on('click', (_, node) => onSelectUnit(node.id));

    nodeGroups.append('circle')
      .attr('r', 28)
      .attr('fill', node => unitMap.get(node.id)?.color || '#a67b54');

    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .text(node => node.id);

    nodeGroups.append('text')
      .attr('class', 'node-phase')
      .attr('text-anchor', 'middle')
      .attr('dy', 45)
      .text(node => node.phase);
  }, [highlightedUnits, onSelectUnit, relationships, selectedUnitId, unitMap, units]);

  return (
    <section className="panel graph-panel">
      <div className="panel-heading">
        <span>Harris Matrix / DAG</span>
        <h2>Depositional Graph</h2>
      </div>
      <svg ref={svgRef} className="harris-svg" role="img" aria-label="D3 Harris Matrix visualization" />
    </section>
  );
}
