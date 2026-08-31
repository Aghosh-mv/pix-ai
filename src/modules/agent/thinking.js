const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class AdvancedThinkingEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.thinkingSessions = new Map();
    this.thoughtGraphs = new Map();
    this.thinkingPatterns = new Map();
    this.evolutionChains = new Map();
    this.thinkingDir = path.join(os.homedir(), '.pix/thinking');

    this.thinkingLevels = [
      { id: 1, name: 'Surface', icon: '💭', description: 'Quick surface-level analysis', depth: 1, timeMultiplier: 1 },
      { id: 2, name: 'Analytical', icon: '🔍', description: 'Break down into components', depth: 2, timeMultiplier: 1.5 },
      { id: 3, name: 'Strategic', icon: '♟️', description: 'Consider long-term implications', depth: 3, timeMultiplier: 2 },
      { id: 4, name: 'Critical', icon: '🎯', description: 'Deep critical evaluation', depth: 4, timeMultiplier: 3 },
      { id: 5, name: 'Creative', icon: '🎨', description: 'Generate novel solutions', depth: 5, timeMultiplier: 2.5 },
      { id: 6, name: 'Metacognitive', icon: '🧠', description: 'Think about thinking itself', depth: 6, timeMultiplier: 4 },
      { id: 7, name: 'Holistic', icon: '🌌', description: 'Consider entire system context', depth: 7, timeMultiplier: 5 },
      { id: 8, name: 'Transcendent', icon: '✨', description: 'Beyond normal reasoning patterns', depth: 8, timeMultiplier: 6 }
    ];

    this.thinkingModes = [
      { id: 'divergent', name: 'Divergent', icon: '↔️', description: 'Generate many possible solutions' },
      { id: 'convergent', name: 'Convergent', icon: '➡️', description: 'Narrow down to best solution' },
      { id: 'lateral', name: 'Lateral', icon: '🔄', description: 'Think sideways, unconventional approaches' },
      { id: 'vertical', name: 'Vertical', icon: '⬆️', description: 'Logical step-by-step reasoning' },
      { id: 'abstract', name: 'Abstract', icon: '🌫️', description: 'Work with concepts and ideas' },
      { id: 'concrete', name: 'Concrete', icon: '🧱', description: 'Work with specific details' },
      { id: 'systematic', name: 'Systematic', icon: '📋', description: 'Methodical approach' },
      { id: 'intuitive', name: 'Intuitive', icon: '💡', description: 'Rapid pattern recognition' }
    ];

    this.cognitiveBiases = [
      { id: 'anchoring', name: 'Anchoring', description: 'Over-relying on first information', mitigation: 'Consider multiple reference points' },
      { id: 'confirmation', name: 'Confirmation Bias', description: 'Seeking confirming evidence', mitigation: 'Actively seek disconfirming evidence' },
      { id: 'availability', name: 'Availability Heuristic', description: 'Overweighting recent events', mitigation: 'Consider base rates and statistics' },
      { id: 'framing', name: 'Framing Effect', description: 'Influenced by presentation', mitigation: 'Reframe problem multiple ways' },
      { id: 'sunk-cost', name: 'Sunk Cost Fallacy', description: 'Past investment affecting decisions', mitigation: 'Focus on future costs and benefits' },
      { id: 'overconfidence', name: 'Overconfidence', description: 'Overestimating certainty', mitigation: 'Assign confidence intervals' },
      { id: 'recency', name: 'Recency Bias', description: 'Remembering recent events better', mitigation: 'Consider historical patterns' },
      { id: 'hindsight', name: 'Hindsight Bias', description: 'Believing outcome was predictable', mitigation: 'Consider what was known at the time' }
    ];

    this.evolutionStrategies = [
      { id: 'mutation', name: 'Mutation', description: 'Random changes to explore new paths', rate: 0.1 },
      { id: 'crossover', name: 'Crossover', description: 'Combine best ideas from different branches', rate: 0.3 },
      { id: 'selection', name: 'Selection', description: 'Keep the best ideas, discard weak ones', pressure: 0.5 },
      { id: 'elitism', name: 'Elitism', description: 'Preserve top ideas unchanged', count: 3 }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Advanced Thinking Engine...');
    await fs.ensureDir(this.thinkingDir);
    await this.loadData();
    this.loadMetacognitionRules();
    this.loadReasoningPatterns();
    this.loadDecisionFrameworks();
    this.loadGraphLayouts();
    this.logger.info('Advanced Thinking Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.thinkingDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.thinkingDir, file));
          if (data.type === 'session') this.thinkingSessions.set(data.id, data);
          else if (data.type === 'graph') this.thoughtGraphs.set(data.id, data);
          else if (data.type === 'pattern') this.thinkingPatterns.set(data.id, data);
          else if (data.type === 'chain') this.evolutionChains.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadMetacognitionRules() {
    this.metacognitionRules = [
      { id: 'self-monitor', name: 'Self-Monitoring', description: 'Track thinking quality in real-time', icon: '📊' },
      { id: 'self-evaluate', name: 'Self-Evaluation', description: 'Assess reasoning after each step', icon: '✅' },
      { id: 'self-correct', name: 'Self-Correction', description: 'Detect and fix reasoning errors', icon: '🔧' },
      { id: 'self-adapt', name: 'Self-Adaptation', description: 'Adjust strategy based on feedback', icon: '🔄' },
      { id: 'confidence-check', name: 'Confidence Check', description: 'Monitor certainty of conclusions', icon: '🎯' },
      { id: 'bias-detection', name: 'Bias Detection', description: 'Identify cognitive biases in reasoning', icon: '⚠️' },
      { id: 'assumption-check', name: 'Assumption Check', description: 'Verify underlying assumptions', icon: '🔍' },
      { id: 'gap-detection', name: 'Gap Detection', description: 'Find missing information or logic', icon: '🕳️' },
      { id: 'coherence-check', name: 'Coherence Check', description: 'Ensure logical consistency', icon: '🔗' },
      { id: 'relevance-check', name: 'Relevance Check', description: 'Stay focused on the main problem', icon: '🎯' }
    ];
  }

  loadReasoningPatterns() {
    this.reasoningPatterns = [
      { id: 'deductive', name: 'Deductive', icon: '⬇️', description: 'General to specific', steps: ['Premise', 'Premise', 'Conclusion'] },
      { id: 'inductive', name: 'Inductive', icon: '⬆️', description: 'Specific to general', steps: ['Observation', 'Pattern', 'Generalization'] },
      { id: 'abductive', name: 'Abductive', icon: '🔄', description: 'Best explanation', steps: ['Observation', 'Possible Explanations', 'Best Fit'] },
      { id: 'analogical', name: 'Analogical', icon: '🔗', description: 'Similar cases', steps: ['Source Case', 'Mapping', 'Target Case'] },
      { id: 'causal', name: 'Causal', icon: '➡️', description: 'Cause and effect', steps: ['Cause', 'Mechanism', 'Effect'] },
      { id: 'probabilistic', name: 'Probabilistic', icon: '🎲', description: 'Likelihood reasoning', steps: ['Evidence', 'Prior', 'Posterior'] },
      { id: 'counterfactual', name: 'Counterfactual', icon: '❓', description: 'What if analysis', steps: ['Actual', 'Alternative', 'Comparison'] },
      { id: 'dialectical', name: 'Dialectical', icon: '⚖️', description: 'Thesis-antithesis-synthesis', steps: ['Thesis', 'Antithesis', 'Synthesis'] }
    ];
  }

  loadDecisionFrameworks() {
    this.decisionFrameworks = [
      { id: 'pros-cons', name: 'Pros and Cons', icon: '⚖️', steps: ['List Pros', 'List Cons', 'Weigh', 'Decide'] },
      { id: 'decision-matrix', name: 'Decision Matrix', icon: '📊', steps: ['Criteria', 'Weight', 'Score', 'Calculate'] },
      { id: 'pareto', name: 'Pareto Analysis', icon: '📈', steps: ['Identify', 'Score', 'Prioritize', 'Focus'] },
      { id: 'six-thinking', name: 'Six Thinking Hats', icon: '🎩', steps: ['Facts', 'Emotions', 'Caution', 'Optimism', 'Creativity', 'Process'] },
      { id: 'swot', name: 'SWOT Analysis', icon: '🔍', steps: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'] },
      { id: 'cost-benefit', name: 'Cost-Benefit', icon: '💰', steps: ['Costs', 'Benefits', 'Compare', 'Decide'] },
      { id: 'expected-value', name: 'Expected Value', icon: '🎯', steps: ['Outcomes', 'Probabilities', 'Values', 'Calculate'] },
      { id: 'multi-criteria', name: 'Multi-Criteria', icon: '📋', steps: ['Criteria', 'Weights', 'Alternatives', 'Evaluate'] }
    ];
  }

  loadGraphLayouts() {
    this.graphLayouts = [
      { id: 'tree', name: 'Tree', icon: '🌳', description: 'Hierarchical branching',适合: 'decision trees' },
      { id: 'mind-map', name: 'Mind Map', icon: '🧠', description: 'Radial expansion',适合: 'brainstorming' },
      { id: 'network', name: 'Network', icon: '🕸️', description: 'Connected nodes',适合: 'relationship analysis' },
      { id: 'timeline', name: 'Timeline', icon: '📅', description: 'Sequential flow',适合: 'process tracking' },
      { id: 'flowchart', name: 'Flowchart', icon: '📊', description: 'Process flow',适合: 'workflow visualization' },
      { id: 'matrix', name: 'Matrix', icon: '🔲', description: 'Grid layout',适合: 'comparison analysis' },
      { id: 'radial', name: 'Radial', icon: '🎯', description: 'Center-outward',适合: 'focus analysis' },
      { id: 'force', name: 'Force-Directed', icon: '💪', description: 'Physics-based',适合: 'cluster analysis' }
    ];
  }

  async createThinkingSession(params) {
    const {
      name,
      problem,
      level = 3,
      mode = 'divergent',
      maxDepth = 5,
      enableMetacognition = true,
      enableBiasDetection = true,
      graphLayout = 'mind-map',
      context = {}
    } = params;

    const id = uuidv4();
    const thinkingLevel = this.thinkingLevels.find(l => l.id === level) || this.thinkingLevels[2];
    const thinkingMode = this.thinkingModes.find(m => m.id === mode) || this.thinkingModes[0];

    const session = {
      id,
      name: name || `Thinking ${id.slice(0, 8)}`,
      problem,
      level: thinkingLevel,
      mode: thinkingMode,
      maxDepth,
      enableMetacognition,
      enableBiasDetection,
      graphLayout,
      context,
      nodes: [],
      edges: [],
      thoughts: [],
      insights: [],
      biases: [],
      confidence: 0.5,
      status: 'active',
      metrics: {
        nodesCreated: 0,
        edgesCreated: 0,
        biasesDetected: 0,
        insightsGained: 0,
        depthReached: 0,
        timeSpent: 0
      },
      type: 'session',
      createdAt: new Date().toISOString()
    };

    this.thinkingSessions.set(id, session);
    await this.saveSession(session);

    return session;
  }

  async addThought(params) {
    const {
      sessionId,
      content,
      parentId = null,
      type = 'observation',
      confidence = 0.5,
      reasoning = '',
      evidence = [],
      alternatives = [],
      tags = []
    } = params;

    const session = this.thinkingSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const thoughtId = uuidv4();
    const depth = parentId ? this.getDepth(session, parentId) + 1 : 0;

    const thought = {
      id: thoughtId,
      sessionId,
      content,
      parentId,
      type,
      confidence,
      reasoning,
      evidence,
      alternatives,
      tags,
      depth,
      children: [],
      metrics: {
        strength: this.calculateStrength(content, evidence, alternatives),
        novelty: this.calculateNovelty(session, content),
        coherence: this.calculateCoherence(session, content, parentId)
      },
      createdAt: new Date().toISOString()
    };

    session.thoughts.push(thought);
    session.nodes.push({
      id: thoughtId,
      label: content.substring(0, 50),
      type,
      confidence,
      depth,
      x: 0,
      y: 0,
      size: 20 + (confidence * 30)
    });

    if (parentId) {
      session.edges.push({
        id: uuidv4(),
        source: parentId,
        target: thoughtId,
        type: 'derives',
        strength: thought.metrics.coherence
      });

      const parentThought = session.thoughts.find(t => t.id === parentId);
      if (parentThought) {
        parentThought.children.push(thoughtId);
      }
    }

    session.metrics.nodesCreated++;
    if (parentId) session.metrics.edgesCreated++;
    session.metrics.depthReached = Math.max(session.metrics.depthReached, depth);

    if (session.enableMetacognition) {
      const metacognition = await this.applyMetacognition(session, thought);
      thought.metacognition = metacognition;
    }

    if (session.enableBiasDetection) {
      const detectedBiases = await this.detectBiases(thought, session);
      if (detectedBiases.length > 0) {
        session.biases.push(...detectedBiases);
        session.metrics.biasesDetected += detectedBiases.length;
        thought.detectedBiases = detectedBiases;
      }
    }

    this.thinkingSessions.set(sessionId, session);
    await this.saveSession(session);

    return thought;
  }

  async addInsight(params) {
    const {
      sessionId,
      content,
      type = 'pattern',
      confidence = 0.7,
      relatedThoughts = [],
      implications = []
    } = params;

    const session = this.thinkingSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const insight = {
      id: uuidv4(),
      sessionId,
      content,
      type,
      confidence,
      relatedThoughts,
      implications,
      impact: this.calculateImpact(session, relatedThoughts),
      novelty: this.calculateInsightNovelty(session, content),
      createdAt: new Date().toISOString()
    };

    session.insights.push(insight);
    session.metrics.insightsGained++;

    this.thinkingSessions.set(sessionId, session);
    await this.saveSession(session);

    return insight;
  }

  async evolveThinking(params) {
    const {
      sessionId,
      generations = 10,
      populationSize = 20,
      mutationRate = 0.1,
      crossoverRate = 0.3
    } = params;

    const session = this.thinkingSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const chainId = uuidv4();
    const chain = {
      id: chainId,
      sessionId,
      generations: [],
      bestFitness: 0,
      avgFitness: 0,
      type: 'chain',
      createdAt: new Date().toISOString()
    };

    let population = this.initializePopulation(session, populationSize);

    for (let gen = 0; gen < generations; gen++) {
      const fitnessScores = population.map(individual => ({
        individual,
        fitness: this.evaluateFitness(individual, session)
      }));

      fitnessScores.sort((a, b) => b.fitness - a.fitness);

      const bestFitness = fitnessScores[0].fitness;
      const avgFitness = fitnessScores.reduce((sum, s) => sum + s.fitness, 0) / fitnessScores.length;

      chain.generations.push({
        generation: gen,
        bestFitness,
        avgFitness,
        bestIndividual: fitnessScores[0].individual,
        population: fitnessScores.map(s => s.individual)
      });

      if (bestFitness > chain.bestFitness) {
        chain.bestFitness = bestFitness;
      }
      chain.avgFitness = avgFitness;

      const newPopulation = [];

      newPopulation.push(fitnessScores[0].individual);
      newPopulation.push(fitnessScores[1].individual);

      while (newPopulation.length < populationSize) {
        if (Math.random() < crossoverRate) {
          const parent1 = this.tournamentSelect(fitnessScores);
          const parent2 = this.tournamentSelect(fitnessScores);
          const child = this.crossover(parent1, parent2);
          newPopulation.push(child);
        } else if (Math.random() < mutationRate) {
          const parent = this.tournamentSelect(fitnessScores);
          const mutant = this.mutate(parent, session);
          newPopulation.push(mutant);
        } else {
          const parent = this.tournamentSelect(fitnessScores);
          newPopulation.push({ ...parent });
        }
      }

      population = newPopulation.slice(0, populationSize);
    }

    this.evolutionChains.set(chainId, chain);

    const bestSolution = chain.generations[chain.generations.length - 1].bestIndividual;
    session.thoughts.push({
      id: uuidv4(),
      content: `Evolution produced solution with fitness ${chain.bestFitness.toFixed(3)}: ${bestSolution.content}`,
      type: 'evolved',
      confidence: chain.bestFitness,
      depth: 0,
      createdAt: new Date().toISOString()
    });

    this.thinkingSessions.set(sessionId, session);
    await this.saveSession(session);
    await this.saveChain(chain);

    return chain;
  }

  initializePopulation(session, size) {
    const population = [];
    const existingThoughts = session.thoughts;

    for (let i = 0; i < size; i++) {
      if (existingThoughts.length > 0 && Math.random() < 0.5) {
        const base = existingThoughts[Math.floor(Math.random() * existingThoughts.length)];
        population.push({
          content: this.mutateContent(base.content),
          confidence: base.confidence + (Math.random() - 0.5) * 0.2,
          tags: [...base.tags],
          fitness: 0
        });
      } else {
        population.push({
          content: this.generateRandomThought(session.problem),
          confidence: Math.random(),
          tags: [],
          fitness: 0
        });
      }
    }

    return population;
  }

  evaluateFitness(individual, session) {
    let fitness = 0;

    fitness += individual.confidence * 0.3;

    const relevanceScore = this.calculateRelevance(individual.content, session.problem);
    fitness += relevanceScore * 0.3;

    const noveltyScore = this.calculateNovelty(session, individual.content);
    fitness += noveltyScore * 0.2;

    const coherenceScore = this.calculateCoherence(session, individual.content, null);
    fitness += coherenceScore * 0.1;

    const depthScore = individual.tags.length > 0 ? 0.1 : 0;
    fitness += depthScore;

    return Math.min(1, fitness);
  }

  calculateRelevance(content, problem) {
    const contentWords = content.toLowerCase().split(/\s+/);
    const problemWords = problem.toLowerCase().split(/\s+/);
    const common = contentWords.filter(w => problemWords.includes(w) && w.length > 3);
    return Math.min(1, common.length / Math.max(1, problemWords.length / 2));
  }

  calculateStrength(content, evidence, alternatives) {
    let strength = 0.5;
    strength += Math.min(evidence.length * 0.1, 0.3);
    strength += Math.min(alternatives.length * 0.05, 0.2);
    return Math.min(1, strength);
  }

  calculateNovelty(session, content) {
    const existing = session.thoughts.map(t => t.content.toLowerCase());
    const contentLower = content.toLowerCase();

    let novelty = 1;
    for (const ex of existing) {
      if (ex === contentLower) novelty -= 0.5;
      else if (ex.includes(contentLower) || contentLower.includes(ex)) novelty -= 0.2;
    }

    return Math.max(0, novelty);
  }

  calculateCoherence(session, content, parentId) {
    if (!parentId) return 0.8;

    const parent = session.thoughts.find(t => t.id === parentId);
    if (!parent) return 0.5;

    const parentWords = parent.content.toLowerCase().split(/\s+/);
    const childWords = content.toLowerCase().split(/\s+/);
    const common = parentWords.filter(w => childWords.includes(w) && w.length > 3);

    return Math.min(1, 0.3 + (common.length * 0.1));
  }

  calculateImpact(session, relatedThoughts) {
    return Math.min(1, relatedThoughts.length * 0.2 + 0.3);
  }

  calculateInsightNovelty(session, content) {
    return this.calculateNovelty(session, content);
  }

  mutateContent(content) {
    const words = content.split(' ');
    const mutationIndex = Math.floor(Math.random() * words.length);
    const synonyms = {
      'good': ['better', 'superior', 'excellent'],
      'bad': ['worse', 'inferior', 'poor'],
      'big': ['large', 'huge', 'massive'],
      'small': ['tiny', 'little', 'miniature'],
      'fast': ['quick', 'rapid', 'swift'],
      'slow': ['sluggish', 'gradual', 'deliberate']
    };

    const word = words[mutationIndex].toLowerCase();
    if (synonyms[word]) {
      const synonym = synonyms[word][Math.floor(Math.random() * synonyms[word].length)];
      words[mutationIndex] = synonym;
    }

    return words.join(' ');
  }

  generateRandomThought(problem) {
    const templates = [
      `Consider ${problem} from a different angle`,
      `What if we approach ${problem} using ${['analogy', 'abstraction', 'decomposition', 'synthesis'][Math.floor(Math.random() * 4)]}?`,
      `The key insight about ${problem} might be ${['its underlying structure', 'the relationships between parts', 'the hidden assumptions', 'the emergent properties'][Math.floor(Math.random() * 4)]}`,
      `A novel approach to ${problem} could involve ${['combining unrelated concepts', 'reversing the normal process', 'scaling up or down', 'changing the perspective'][Math.floor(Math.random() * 4)]}`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  tournamentSelect(fitnessScores, tournamentSize = 3) {
    const tournament = [];
    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * fitnessScores.length);
      tournament.push(fitnessScores[randomIndex]);
    }
    tournament.sort((a, b) => b.fitness - a.fitness);
    return tournament[0].individual;
  }

  crossover(parent1, parent2) {
    const words1 = parent1.content.split(' ');
    const words2 = parent2.content.split(' ');
    const crossoverPoint = Math.floor(Math.random() * Math.min(words1.length, words2.length));

    const childContent = [...words1.slice(0, crossoverPoint), ...words2.slice(crossoverPoint)].join(' ');

    return {
      content: childContent,
      confidence: (parent1.confidence + parent2.confidence) / 2,
      tags: [...new Set([...parent1.tags, ...parent2.tags])],
      fitness: 0
    };
  }

  mutate(individual, session) {
    const mutated = { ...individual };

    if (Math.random() < 0.3) {
      mutated.content = this.mutateContent(mutated.content);
    }

    if (Math.random() < 0.2) {
      mutated.confidence = Math.max(0, Math.min(1, mutated.confidence + (Math.random() - 0.5) * 0.3));
    }

    return mutated;
  }

  getDepth(session, thoughtId) {
    let depth = 0;
    let currentId = thoughtId;

    while (currentId) {
      const thought = session.thoughts.find(t => t.id === currentId);
      if (!thought || !thought.parentId) break;
      depth++;
      currentId = thought.parentId;
    }

    return depth;
  }

  async applyMetacognition(session, thought) {
    const results = [];

    for (const rule of this.metacognitionRules) {
      const result = {
        rule: rule.id,
        name: rule.name,
        passed: true,
        message: ''
      };

      switch (rule.id) {
        case 'confidence-check':
          if (thought.confidence < 0.3) {
            result.passed = false;
            result.message = 'Low confidence detected. Consider gathering more evidence.';
          }
          break;

        case 'coherence-check':
          if (thought.parentId && thought.metrics.coherence < 0.4) {
            result.passed = false;
            result.message = 'Low coherence with parent thought. Ensure logical connection.';
          }
          break;

        case 'gap-detection':
          if (thought.evidence.length === 0 && thought.confidence > 0.7) {
            result.passed = false;
            result.message = 'High confidence without evidence. Consider supporting data.';
          }
          break;

        case 'relevance-check':
          const relevance = this.calculateRelevance(thought.content, session.problem);
          if (relevance < 0.3) {
            result.passed = false;
            result.message = 'Thought may be off-topic. Refocus on the main problem.';
          }
          break;

        default:
          result.message = 'Check passed';
      }

      results.push(result);
    }

    return results;
  }

  async detectBiases(thought, session) {
    const detected = [];

    if (thought.confidence > 0.9 && thought.evidence.length < 2) {
      detected.push({
        ...this.cognitiveBiases.find(b => b.id === 'overconfidence'),
        thoughtId: thought.id
      });
    }

    if (thought.alternatives.length === 0 && thought.depth > 2) {
      detected.push({
        ...this.cognitiveBiases.find(b => b.id === 'confirmation'),
        thoughtId: thought.id
      });
    }

    const recentThoughts = session.thoughts.slice(-5);
    if (recentThoughts.length >= 3) {
      const avgConfidence = recentThoughts.reduce((sum, t) => sum + t.confidence, 0) / recentThoughts.length;
      if (avgConfidence > 0.8) {
        detected.push({
          ...this.cognitiveBiases.find(b => b.id === 'anchoring'),
          thoughtId: thought.id
        });
      }
    }

    return detected;
  }

  async synthesizeSession(sessionId) {
    const session = this.thinkingSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const synthesis = {
      id: uuidv4(),
      sessionId,
      summary: this.generateSummary(session),
      keyInsights: session.insights.slice(0, 5),
      strongestThoughts: session.thoughts
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5),
      detectedBiases: session.biases,
      metrics: session.metrics,
      confidence: this.calculateOverallConfidence(session),
      recommendations: this.generateRecommendations(session),
      createdAt: new Date().toISOString()
    };

    session.synthesis = synthesis;
    session.status = 'completed';
    this.thinkingSessions.set(sessionId, session);
    await this.saveSession(session);

    return synthesis;
  }

  generateSummary(session) {
    const thoughtCount = session.thoughts.length;
    const insightCount = session.insights.length;
    const avgConfidence = session.thoughts.length > 0
      ? session.thoughts.reduce((sum, t) => sum + t.confidence, 0) / session.thoughts.length
      : 0;

    return `Thinking session explored ${thoughtCount} thoughts with ${insightCount} insights. Average confidence: ${(avgConfidence * 100).toFixed(1)}%. Reached depth ${session.metrics.depthReached}. Detected ${session.metrics.biasesDetected} potential biases.`;
  }

  calculateOverallConfidence(session) {
    if (session.thoughts.length === 0) return 0.5;

    const confidences = session.thoughts.map(t => t.confidence);
    const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    const depthBonus = Math.min(session.metrics.depthReached * 0.05, 0.2);
    const insightBonus = Math.min(session.insights.length * 0.03, 0.15);

    return Math.min(1, avg + depthBonus + insightBonus);
  }

  generateRecommendations(session) {
    const recommendations = [];

    if (session.metrics.depthReached < 3) {
      recommendations.push({
        type: 'depth',
        message: 'Consider thinking deeper. Explore more branches of reasoning.',
        priority: 'high'
      });
    }

    if (session.insights.length < 2) {
      recommendations.push({
        type: 'insights',
        message: 'Try to identify more patterns and insights.',
        priority: 'medium'
      });
    }

    if (session.biases.length > 2) {
      recommendations.push({
        type: 'bias',
        message: `Detected ${session.biases.length} potential biases. Consider alternative perspectives.`,
        priority: 'high'
      });
    }

    if (session.thoughts.every(t => t.type === 'observation')) {
      recommendations.push({
        type: 'diversity',
        message: 'Add more thought types (hypothesis, conclusion, evaluation) for richer thinking.',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  async getGraphData(sessionId) {
    const session = this.thinkingSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    return {
      nodes: session.nodes.map(node => ({
        ...node,
        color: this.getNodeColor(node.type),
        label: node.label
      })),
      edges: session.edges.map(edge => ({
        ...edge,
        color: '#666',
        width: edge.strength * 3
      })),
      layout: session.graphLayout
    };
  }

  getNodeColor(type) {
    const colors = {
      observation: '#4CAF50',
      hypothesis: '#2196F3',
      conclusion: '#FF9800',
      evaluation: '#9C27B0',
      evolved: '#F44336',
      insight: '#FFD700'
    };
    return colors[type] || '#607D8B';
  }

  async getSession(id) {
    return this.thinkingSessions.get(id);
  }

  listSessions(options = {}) {
    const { status, search } = options;
    let sessions = Array.from(this.thinkingSessions.values());

    if (status) sessions = sessions.filter(s => s.status === status);
    if (search) {
      const searchLower = search.toLowerCase();
      sessions = sessions.filter(s =>
        s.name.toLowerCase().includes(searchLower) ||
        s.problem.toLowerCase().includes(searchLower)
      );
    }

    return sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getThinkingLevels() {
    return this.thinkingLevels;
  }

  getThinkingModes() {
    return this.thinkingModes;
  }

  getReasoningPatterns() {
    return this.reasoningPatterns;
  }

  getDecisionFrameworks() {
    return this.decisionFrameworks;
  }

  getCognitiveBiases() {
    return this.cognitiveBiases;
  }

  getGraphLayouts() {
    return this.graphLayouts;
  }

  async getStats() {
    const sessions = Array.from(this.thinkingSessions.values());
    const chains = Array.from(this.evolutionChains.values());

    return {
      sessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      totalThoughts: sessions.reduce((sum, s) => sum + s.thoughts.length, 0),
      totalInsights: sessions.reduce((sum, s) => sum + s.insights.length, 0),
      totalBiases: sessions.reduce((sum, s) => sum + s.biases.length, 0),
      averageConfidence: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.confidence, 0) / sessions.length
        : 0,
      evolutionChains: chains.length,
      bestFitness: chains.length > 0
        ? Math.max(...chains.map(c => c.bestFitness))
        : 0,
      thinkingLevels: this.thinkingLevels.length,
      thinkingModes: this.thinkingModes.length,
      reasoningPatterns: this.reasoningPatterns.length,
      decisionFrameworks: this.decisionFrameworks.length
    };
  }

  async saveSession(session) {
    const filePath = path.join(this.thinkingDir, `session-${session.id}.json`);
    await fs.writeJson(filePath, session, { spaces: 2 });
  }

  async saveChain(chain) {
    const filePath = path.join(this.thinkingDir, `chain-${chain.id}.json`);
    await fs.writeJson(filePath, chain, { spaces: 2 });
  }

  async exportThinking(format = 'json') {
    const data = {
      sessions: Array.from(this.thinkingSessions.values()),
      graphs: Array.from(this.thoughtGraphs.values()),
      chains: Array.from(this.evolutionChains.values()),
      patterns: this.thinkingPatterns,
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = AdvancedThinkingEngine;
