import ast
import re
from typing import Dict, List, Set, Tuple
import astroid
from pylint.checkers import BaseChecker
from pylint.lint import Run
import bandit
from bandit.core import manager
import radon.complexity as cc
from radon.visitors import ComplexityVisitor
import radon.metrics as metrics
from bandit.core.config import BanditConfig

class EnhancedCodeAnalyzer:
    def __init__(self, source_code: str, file_path: str):
        self.source_code = source_code
        self.file_path = file_path
        self.tree = ast.parse(source_code)
        self.astroid_tree = astroid.parse(source_code)
        
    def calculate_complexity_metrics(self) -> Dict:
        """Calculate various complexity metrics for the code."""
        metrics = {}
        visitor = ComplexityVisitor.from_code(self.source_code)
        
        for function in visitor.functions:
            metrics[function.name] = {
                'cyclomatic_complexity': function.complexity,
                'loc': function.endline - function.lineno + 1,
            }
            
        return metrics
    
    def detect_code_smells(self) -> List[Dict]:
        """Detect common code smells using pylint."""
        smells = []
        
        class SmellChecker(BaseChecker):
            name = 'smell-checker'
            priority = -1
            
            def visit_functiondef(self, node):
                # Long method smell
                if node.lineno and node.end_lineno:
                    if node.end_lineno - node.lineno > 20:
                        smells.append({
                            'type': 'long_method',
                            'name': node.name,
                            'line': node.lineno,
                            'description': 'Method is too long (> 20 lines)'
                        })
                
                # Too many parameters smell
                if len(node.args.args) > 5:
                    smells.append({
                        'type': 'too_many_parameters',
                        'name': node.name,
                        'line': node.lineno,
                        'description': f'Method has too many parameters ({len(node.args.args)})'
                    })
        
        Run([self.file_path], do_exit=False)
        return smells
    
    def scan_security_vulnerabilities(self) -> List[Dict]:
        """Scan for security vulnerabilities using bandit."""
        vulnerabilities = []
        
        # Create a default BanditConfig instance
        config = BanditConfig()

        # Initialize BanditManager with config and aggregation type
        b_mgr = manager.BanditManager(config, 'vuln')
        b_mgr.discover_files([self.file_path])
        b_mgr.run_tests()
        
        for result in b_mgr.get_issue_list():
            vulnerabilities.append({
                'type': result.issue_type,
                'severity': result.severity,
                'line': result.lineno,
                'description': result.message
            })
            
        return vulnerabilities
    
    def find_code_duplication(self) -> List[Dict]:
        """Find duplicated code blocks."""
        duplications = []
        
        # Simple token-based duplication detection
        lines = self.source_code.split('\n')
        for i in range(len(lines)):
            for j in range(i + 1, len(lines)):
                if lines[i] == lines[j] and len(lines[i].strip()) > 0:
                    duplications.append({
                        'line1': i + 1,
                        'line2': j + 1,
                        'code': lines[i]
                    })
                    
        return duplications
    
    def analyze_performance(self) -> Dict:
        """Analyze code for potential performance issues."""
        performance_issues = []
        
        # Check for nested loops
        for node in ast.walk(self.tree):
            if isinstance(node, ast.For):
                for child in ast.walk(node):
                    if isinstance(child, ast.For):
                        performance_issues.append({
                            'type': 'nested_loop',
                            'line': node.lineno,
                            'description': 'Nested loops detected - potential performance bottleneck'
                        })
                        
        # Check for large list comprehensions
        for node in ast.walk(self.tree):
            if isinstance(node, ast.ListComp):
                if len(node.generators) > 1:
                    performance_issues.append({
                        'type': 'complex_list_comp',
                        'line': node.lineno,
                        'description': 'Complex list comprehension detected'
                    })
                    
        return {'issues': performance_issues}
    
    def generate_documentation(self) -> Dict:
        """Generate documentation for functions and classes."""
        documentation = {}
        
        for node in ast.walk(self.tree):
            if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                doc = ast.get_docstring(node)
                params = []
                returns = None
                
                if isinstance(node, ast.FunctionDef):
                    for arg in node.args.args:
                        params.append(arg.arg)
                    if node.returns:
                        returns = ast.unparse(node.returns)
                
                documentation[node.name] = {
                    'docstring': doc,
                    'parameters': params,
                    'return_type': returns,
                    'line': node.lineno
                }
                
        return documentation
    
    def get_analysis_results(self) -> Dict:
        """Get all analysis results in a single dictionary."""
        return {
            'complexity_metrics': self.calculate_complexity_metrics(),
            'code_smells': self.detect_code_smells(),
            'security_vulnerabilities': self.scan_security_vulnerabilities(),
            'code_duplication': self.find_code_duplication(),
            'performance_analysis': self.analyze_performance(),
            'documentation': self.generate_documentation()
        } 