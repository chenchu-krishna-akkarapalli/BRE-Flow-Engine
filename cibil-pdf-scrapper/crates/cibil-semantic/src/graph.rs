use serde::{Serialize, Deserialize};
use petgraph::graph::{DiGraph, NodeIndex};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum SemanticNode {
    Document,
    Page { number: u32, x0: f32, y0: f32, x1: f32, y1: f32 },
    Block { text: String, x0: f32, y0: f32, x1: f32, y1: f32 },
    Paragraph { text: String, x0: f32, y0: f32, x1: f32, y1: f32 },
    Table { rows: usize, cols: usize, x0: f32, y0: f32, x1: f32, y1: f32 },
    Row { index: usize },
    Cell { row: usize, col: usize, text: String, x0: f32, y0: f32, x1: f32, y1: f32 },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum SemanticEdge {
    Contains,
    AssociatedWith,
    Sibling,
}

pub struct SemanticGraph {
    pub graph: DiGraph<SemanticNode, SemanticEdge>,
    pub root: NodeIndex,
}

impl Default for SemanticGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl SemanticGraph {
    pub fn new() -> Self {
        let mut graph = DiGraph::new();
        let root = graph.add_node(SemanticNode::Document);
        Self { graph, root }
    }
}
