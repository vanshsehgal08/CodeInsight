// Enhanced visualization features for code analysis
class CodeVisualizer {
    constructor(containerId) {
        this.container = d3.select(`#${containerId}`);
        this.width = this.container.node().getBoundingClientRect().width;
        this.height = this.container.node().getBoundingClientRect().height;
        this.svg = this.container.append('svg')
            .attr('width', this.width)
            .attr('height', this.height);
        
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => this.handleZoom(event));
            
        this.svg.call(this.zoom);
        
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(50));
            
        this.currentLayout = 'force';
        this.minimap = null;
        this.searchResults = [];
        this.colorScale = d3.scaleSequential(d3.interpolateViridis)
            .domain([0, 10]); // For complexity metrics
    }
    
    // Layout management
    setLayout(layoutType) {
        this.currentLayout = layoutType;
        switch(layoutType) {
            case 'force':
                this.applyForceLayout();
                break;
            case 'hierarchical':
                this.applyHierarchicalLayout();
                break;
            case 'radial':
                this.applyRadialLayout();
                break;
        }
    }
    
    applyForceLayout() {
        this.simulation
            .force('link', d3.forceLink().id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2));
        this.simulation.alpha(1).restart();
    }
    
    applyHierarchicalLayout() {
        const treeLayout = d3.tree()
            .size([this.width, this.height - 100]);
            
        const root = d3.hierarchy(this.data);
        const nodes = treeLayout(root);
        
        this.updateNodePositions(nodes);
    }
    
    applyRadialLayout() {
        const radialLayout = d3.forceRadial()
            .radius(d => d.depth * 100)
            .x(this.width / 2)
            .y(this.height / 2);
            
        this.simulation
            .force('radial', radialLayout)
            .force('link', d3.forceLink().id(d => d.id).distance(50));
        this.simulation.alpha(1).restart();
    }
    
    // Zoom and pan controls
    handleZoom(event) {
        this.svg.selectAll('g')
            .attr('transform', event.transform);
            
        if (this.minimap) {
            this.updateMinimap(event.transform);
        }
    }
    
    // Search functionality
    searchNodes(query) {
        this.searchResults = this.nodes.filter(node => 
            node.id.toLowerCase().includes(query.toLowerCase())
        );
        this.highlightSearchResults();
    }
    
    highlightSearchResults() {
        this.svg.selectAll('.node')
            .classed('search-result', d => this.searchResults.includes(d));
    }
    
    // Color coding based on metrics
    updateNodeColors(metric) {
        this.svg.selectAll('.node')
            .attr('fill', d => this.colorScale(d[metric]));
    }
    
    // Minimap implementation
    createMinimap() {
        const minimapSize = 150;
        this.minimap = this.container.append('div')
            .attr('class', 'minimap')
            .style('position', 'absolute')
            .style('bottom', '20px')
            .style('right', '20px')
            .style('width', `${minimapSize}px`)
            .style('height', `${minimapSize}px`)
            .style('background', 'rgba(255, 255, 255, 0.1)')
            .style('border', '1px solid #ccc');
            
        this.minimap.append('svg')
            .attr('width', '100%')
            .attr('height', '100%');
            
        this.updateMinimap();
    }
    
    updateMinimap(transform) {
        if (!this.minimap) return;
        
        const minimapSvg = this.minimap.select('svg');
        const scale = 0.2; // Minimap scale factor
        
        minimapSvg.selectAll('*').remove();
        
        // Draw simplified version of the graph
        minimapSvg.selectAll('circle')
            .data(this.nodes)
            .enter()
            .append('circle')
            .attr('cx', d => d.x * scale)
            .attr('cy', d => d.y * scale)
            .attr('r', 2)
            .attr('fill', '#666');
            
        // Draw viewport rectangle
        if (transform) {
            minimapSvg.append('rect')
                .attr('x', -transform.x * scale)
                .attr('y', -transform.y * scale)
                .attr('width', this.width * scale / transform.k)
                .attr('height', this.height * scale / transform.k)
                .attr('fill', 'none')
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
        }
    }
    
    // Data update and rendering
    updateData(data) {
        this.data = data;
        this.nodes = data.nodes;
        this.links = data.links;
        
        this.render();
    }
    
    render() {
        // Clear existing elements
        this.svg.selectAll('*').remove();
        
        // Create main group for zoom
        const g = this.svg.append('g');
        
        // Draw links
        const link = g.selectAll('.link')
            .data(this.links)
            .enter()
            .append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);
            
        // Draw nodes
        const node = g.selectAll('.node')
            .data(this.nodes)
            .enter()
            .append('circle')
            .attr('class', 'node')
            .attr('r', 5)
            .attr('fill', d => this.colorScale(d.complexity || 0))
            .call(d3.drag()
                .on('start', this.dragstarted.bind(this))
                .on('drag', this.dragged.bind(this))
                .on('end', this.dragended.bind(this)));
                
        // Add labels
        const label = g.selectAll('.label')
            .data(this.nodes)
            .enter()
            .append('text')
            .attr('class', 'label')
            .attr('dy', -10)
            .text(d => d.id);
            
        // Update positions on simulation tick
        this.simulation
            .nodes(this.nodes)
            .on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
                    
                node
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);
                    
                label
                    .attr('x', d => d.x)
                    .attr('y', d => d.y);
            });
            
        this.simulation.force('link')
            .links(this.links);
    }
    
    // Drag behavior
    dragstarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    dragended(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
} 