/* ============================================================
   Single source of truth for the whole curriculum.
   - Sidebar, the /path page, and the landing-page graph all read this.
   - `status: 'ready'` means a matching MDX lesson exists in
     src/content/lessons/<slug>.mdx and will be rendered.
   - `status: 'soon'` lessons still appear in the nav/path (so the
     full learning journey is visible) but render a "coming soon" page.
   The slug is "<trackId>/<lessonId>" and is the URL path.
   ============================================================ */

export type LessonStatus = 'ready' | 'soon';

export interface LessonMeta {
  id: string;          // lesson id within the track
  title: string;
  summary: string;
  status: LessonStatus;
}

// The site hosts multiple courses; each has its own ordered stages.
export type CourseId = 'ml' | 'gamedev' | 'dsa';

export interface CourseMeta {
  id: CourseId;
  title: string;
  short: string;
  icon: string;
  blurb: string;
  stages: string[];    // ordered stage names (unique across courses)
}

export const COURSES: CourseMeta[] = [
  {
    id: 'ml',
    title: 'Mathematics for Machine Learning',
    short: 'ML Maths',
    icon: '🧮',
    blurb: 'From algebra to LLMs: every piece of math behind machine learning, deep learning and transformers.',
    stages: [
      'Foundations',
      'Core Math',
      'Machine Learning',
      'Deep Learning',
      'LLMs & Generative AI',
      'Reinforcement Learning',
    ],
  },
  {
    id: 'gamedev',
    title: 'Game Development',
    short: 'Game Dev',
    icon: '🎮',
    blurb: 'From bits and memory to physics, rendering and netcode — how games really work, bottom to top.',
    stages: [
      'Computer Foundations',
      'Programming Foundations',
      'Game Math',
      'Game Physics',
      'Graphics & Rendering',
      'Engine Architecture',
      'Game AI',
      'Networking & Advanced',
    ],
  },
  {
    id: 'dsa',
    title: 'Data Structures & Algorithms',
    short: 'DSA',
    icon: '🧩',
    blurb: 'From Big-O to max-flow, suffix automata and FFT — every data structure and algorithm, built as an animated, runnable, intuition-first study companion.',
    stages: [
      'DSA Foundations',
      'Core Data Structures',
      'Sorting & Searching',
      'Graphs & Networks',
      'Algorithm Paradigms',
      'Advanced Algorithms & Structures',
      'Math & Specialized Algorithms',
      'Applied Algorithms & Systems',
    ],
  },
];

// stage name -> course (stage names are unique across courses)
const STAGE_TO_COURSE = new Map<string, CourseId>();
for (const c of COURSES) for (const s of c.stages) STAGE_TO_COURSE.set(s, c.id);
export function courseOfStage(stage: string): CourseId {
  return STAGE_TO_COURSE.get(stage) ?? 'ml';
}
export function getCourse(id: CourseId): CourseMeta {
  return COURSES.find((c) => c.id === id)!;
}

export interface Track {
  id: string;          // also the Tailwind color key
  title: string;
  stage: string;       // belongs to a course via STAGE_TO_COURSE
  icon: string;        // emoji glyph used in nav/cards
  blurb: string;
  lessons: LessonMeta[];
}

const soon = (id: string, title: string, summary: string): LessonMeta => ({
  id,
  title,
  summary,
  status: 'soon',
});

export const TRACKS: Track[] = [
  // ---------------- FOUNDATIONS ----------------
  {
    id: 'algebra-1',
    title: 'Algebra 1',
    stage: 'Foundations',
    icon: '🔤',
    blurb: 'The language of math: variables, equations and the coordinate plane.',
    lessons: [
      soon('numbers-operations', 'Numbers & Operations', 'Integers, fractions, order of operations — the rules of the game.'),
      soon('variables-expressions', 'Variables & Expressions', 'Letters that stand for numbers, and how to simplify them.'),
      soon('linear-equations', 'Linear Equations & Inequalities', 'Solving for the unknown and reasoning about ranges.'),
      soon('coordinate-plane', 'The Coordinate Plane', 'Turning pairs of numbers into points and pictures.'),
      soon('intro-functions', 'Intro to Functions', 'Machines that take an input and return one output.'),
      soon('slope-linear', 'Slope & Linear Functions', 'Steepness, rate of change, and the equation of a line.'),
    ],
  },
  {
    id: 'algebra-2',
    title: 'Algebra 2',
    stage: 'Foundations',
    icon: '🧮',
    blurb: 'Curves, growth and decay: quadratics, polynomials, exponentials and logs.',
    lessons: [
      soon('quadratics', 'Quadratics & Factoring', 'Parabolas, roots, and completing the square.'),
      soon('polynomials', 'Polynomials', 'Adding, multiplying and breaking apart higher-degree expressions.'),
      soon('exponents-radicals', 'Exponents & Radicals', 'Powers, roots and the rules that govern them.'),
      soon('exp-log', 'Exponential & Logarithmic Functions', 'Explosive growth and its inverse — the logarithm.'),
      soon('rational-expressions', 'Rational Expressions', 'Fractions where the numerator and denominator are polynomials.'),
      soon('systems-equations', 'Systems of Equations', 'Finding values that satisfy several equations at once.'),
      soon('sequences-series-basics', 'Sequences & Series', 'Patterns of numbers and their running totals.'),
    ],
  },
  {
    id: 'geometry',
    title: 'Geometry',
    stage: 'Foundations',
    icon: '📐',
    blurb: 'Shape, space and distance — the visual backbone of vectors.',
    lessons: [
      soon('points-lines-angles', 'Points, Lines & Angles', 'The atoms of geometry and how they relate.'),
      soon('pythagoras', 'Triangles & the Pythagorean Theorem', 'The most useful equation about right triangles.'),
      soon('similarity-congruence', 'Similarity & Congruence', 'When are two shapes "the same"?'),
      soon('circles', 'Circles', 'Radius, circumference, area and the number π.'),
      soon('area-volume', 'Area & Volume', 'Measuring flat regions and solid space.'),
      soon('coordinate-geometry', 'Coordinate Geometry & Distance', 'Geometry meets algebra: the distance formula.'),
      soon('transformations', 'Transformations', 'Sliding, rotating and scaling shapes — a first look at vectors.'),
    ],
  },
  {
    id: 'trigonometry',
    title: 'Trigonometry',
    stage: 'Foundations',
    icon: '🌀',
    blurb: 'Angles and waves: the math of anything that repeats.',
    lessons: [
      soon('angles-radians', 'Angles & Radians', 'Two ways to measure rotation, and why radians win.'),
      soon('right-triangle-ratios', 'Right-Triangle Ratios', 'SOH-CAH-TOA: sine, cosine and tangent.'),
      // FLAGSHIP
      { id: 'unit-circle', title: 'The Unit Circle', summary: 'The single picture that ties together every trig function.', status: 'ready' },
      soon('trig-graphs', 'Graphs of Trig Functions', 'How sine and cosine become smooth, endless waves.'),
      soon('identities', 'Trig Identities', 'Equations that are always true, and how to use them.'),
      soon('inverse-trig', 'Inverse Trig Functions', 'Going from a ratio back to the angle.'),
      soon('laws-sines-cosines', 'Law of Sines & Cosines', 'Solving triangles that are not right-angled.'),
    ],
  },
  {
    id: 'precalculus',
    title: 'Pre-Calculus',
    stage: 'Foundations',
    icon: '📈',
    blurb: 'The bridge to calculus: functions in depth and a first taste of limits.',
    lessons: [
      soon('transformations-composition', 'Transformations & Composition', 'Shifting, stretching and chaining functions together.'),
      soon('poly-rational-functions', 'Polynomial & Rational Functions', 'Behavior, asymptotes and end behavior.'),
      soon('exp-log-depth', 'Exponentials & Logs in Depth', 'Modeling growth, decay and scale.'),
      soon('intro-limits', 'Intro to Limits', 'What value does a function approach? The idea behind calculus.'),
      soon('sequences-series', 'Sequences & Series', 'Convergence, divergence and infinite sums.'),
      soon('parametric-polar', 'Parametric & Polar', 'Describing curves with a parameter or an angle.'),
      soon('conic-sections', 'Conic Sections', 'Circles, ellipses, parabolas and hyperbolas.'),
    ],
  },
  {
    id: 'complex-numbers',
    title: 'Complex Numbers',
    stage: 'Foundations',
    icon: '𝑖',
    blurb: 'A second dimension for numbers — and the language of waves and rotation.',
    lessons: [
      soon('imaginary-unit', 'The Imaginary Unit', 'What is √−1? Meet i and how complex numbers add and multiply.'),
      soon('complex-plane', 'The Complex Plane', 'Every complex number is a point — and an arrow — on the Argand plane.'),
      soon('polar-form', 'Polar Form & Multiplication', 'Multiplying complex numbers rotates and scales.'),
      soon('eulers-formula', "Euler's Formula", 'The most beautiful equation: e^{iθ} = cos θ + i·sin θ.'),
    ],
  },
  {
    id: 'discrete-math',
    title: 'Discrete Math & Logic',
    stage: 'Foundations',
    icon: '🔗',
    blurb: 'The rigorous toolkit: sets, logic, proofs and structures.',
    lessons: [
      soon('sets', 'Sets & Set Operations', 'Collections of things, unions, intersections and Venn diagrams.'),
      soon('logic', 'Logic & Truth Tables', 'AND, OR, NOT, implication — the algebra of true and false.'),
      soon('proofs-induction', 'Proofs & Induction', 'How we know something is true for all numbers.'),
      soon('relations-graphs', 'Relations, Functions & Graphs', 'Mappings between sets and the networks they form.'),
    ],
  },

  // ---------------- CORE (ML MATH) ----------------
  {
    id: 'calculus-1',
    title: 'Calculus 1',
    stage: 'Core Math',
    icon: '∂',
    blurb: 'Change and accumulation: derivatives and integrals.',
    lessons: [
      soon('limits-continuity', 'Limits & Continuity', 'Making the idea of "approaching" precise.'),
      // FLAGSHIP
      { id: 'derivative', title: 'The Derivative', summary: 'The instantaneous rate of change — the slope of a curve at a point.', status: 'ready' },
      soon('differentiation-rules', 'Differentiation Rules & Chain Rule', 'Fast recipes for derivatives, including composition.'),
      soon('applications-derivatives', 'Applications of Derivatives', 'Optimization, related rates and curve sketching.'),
      soon('integrals-ftc', 'Integrals & the Fundamental Theorem', 'Accumulation and the deep link between area and slope.'),
    ],
  },
  {
    id: 'calculus-2',
    title: 'Calculus 2',
    stage: 'Core Math',
    icon: '∫',
    blurb: 'Integration mastery and infinite series.',
    lessons: [
      soon('integration-techniques', 'Integration Techniques', 'Substitution, by parts, and partial fractions.'),
      soon('applications-integrals', 'Applications of Integrals', 'Areas, volumes, averages and probability.'),
      soon('sequences-series-2', 'Sequences & Series', 'Convergence tests and power series.'),
      soon('taylor-series', 'Taylor Series', 'Approximating any function with polynomials.'),
    ],
  },
  {
    id: 'calculus-3',
    title: 'Calculus 3',
    stage: 'Core Math',
    icon: '∇',
    blurb: 'Multivariable calculus — the gradient that powers learning.',
    lessons: [
      soon('multivariable-functions', 'Functions of Several Variables', 'Surfaces and contour maps.'),
      soon('partial-derivatives', 'Partial Derivatives', 'Rate of change in one direction at a time.'),
      soon('gradient', 'The Gradient & Directional Derivatives', 'The direction of steepest ascent.'),
      soon('chain-rule-jacobian', 'Multivariable Chain Rule & Jacobian', 'Composing vector-valued functions.'),
      soon('hessian', 'The Hessian', 'Curvature in many dimensions.'),
      soon('multiple-integrals', 'Multiple Integrals', 'Volume under a surface.'),
      soon('vector-calculus-ml', 'Vector Calculus for ML', 'The math behind backpropagation.'),
    ],
  },
  {
    id: 'differential-equations',
    title: 'Differential Equations',
    stage: 'Core Math',
    icon: '🌱',
    blurb: 'Equations that describe how things change over time.',
    lessons: [
      soon('intro-odes', 'Intro to ODEs', 'Equations involving a function and its derivatives.'),
      soon('first-order', 'First-Order ODEs', 'Separable and linear equations.'),
      soon('second-order', 'Second-Order Linear ODEs', 'Oscillations, springs and resonance.'),
      soon('applications-de', 'Applications', 'Growth, decay, cooling and motion.'),
      soon('numerical-euler', "Numerical Methods (Euler)", 'Solving equations a computer can handle.'),
    ],
  },
  {
    id: 'linear-algebra',
    title: 'Linear Algebra',
    stage: 'Core Math',
    icon: '⬚',
    blurb: 'Vectors, matrices and transformations — the data structures of ML.',
    lessons: [
      // FLAGSHIP (reference implementation)
      { id: 'vectors', title: 'Vectors', summary: 'Arrows with direction and length — and lists of numbers that describe anything.', status: 'ready' },
      soon('vector-ops-dot', 'Vector Operations & Dot Product', 'Adding, scaling and measuring similarity.'),
      soon('span', 'Linear Combinations & Span', 'Every place you can reach with a set of vectors.'),
      soon('matrices', 'Matrices', 'Grids of numbers that store and transform data.'),
      soon('matrix-multiplication', 'Matrix Multiplication', 'Composing transformations.'),
      soon('gaussian-elimination', 'Systems & Gaussian Elimination', 'Solving many equations at once.'),
      soon('inverse-determinant', 'Inverse & Determinant', 'Undoing transformations and measuring how they scale space.'),
      soon('vector-spaces', 'Vector Spaces, Basis & Rank', 'The structure underneath all of linear algebra.'),
      soon('linear-transformations', 'Linear Transformations', 'Functions that keep grids straight and evenly spaced.'),
      soon('eigenvectors', 'Eigenvalues & Eigenvectors', 'The directions a transformation does not turn.'),
      soon('orthogonality-projections', 'Orthogonality & Projections', 'Right angles and shadows — the heart of least squares.'),
      soon('inner-product-functions', 'Inner Product of Functions', 'Treating whole functions as vectors you can project and compare.'),
      soon('decompositions', 'Matrix Decompositions (LU/QR/SVD)', 'Factoring matrices into simpler pieces.'),
      soon('pca', 'PCA', 'Finding the directions that matter most in data.'),
    ],
  },
  {
    id: 'combinatorics',
    title: 'Combinatorics',
    stage: 'Core Math',
    icon: '🔢',
    blurb: 'The art of counting — the foundation under every probability.',
    lessons: [
      soon('counting-principles', 'Counting Principles', 'The multiplication and addition rules for counting possibilities.'),
      soon('permutations', 'Permutations', 'Counting ordered arrangements.'),
      soon('combinations', 'Combinations', 'Counting selections where order does not matter.'),
      soon('binomial-theorem', 'Binomial Theorem & Pascal’s Triangle', 'Expanding (a+b)ⁿ and the pattern of the coefficients.'),
    ],
  },
  {
    id: 'probability',
    title: 'Probability',
    stage: 'Core Math',
    icon: '🎲',
    blurb: 'Reasoning about uncertainty — the language of machine learning.',
    lessons: [
      soon('sample-spaces', 'Sample Spaces & Events', 'Listing what can happen, and assigning chances.'),
      soon('conditional-bayes', 'Conditional Probability & Bayes', 'Updating beliefs when new evidence arrives.'),
      // FLAGSHIP
      { id: 'random-variables', title: 'Random Variables', summary: 'Turning random outcomes into numbers we can compute with.', status: 'ready' },
      soon('discrete-distributions', 'Discrete Distributions', 'Bernoulli, Binomial and Poisson.'),
      soon('continuous-distributions', 'Continuous Distributions', 'Uniform, Exponential and the Gaussian.'),
      soon('expectation-variance', 'Expectation & Variance', 'The center and the spread of randomness.'),
      soon('joint-covariance', 'Joint Distributions & Covariance', 'How two random quantities move together.'),
      soon('clt', 'The Central Limit Theorem', 'Why the bell curve appears everywhere.'),
      soon('conjugacy-exponential-family', 'Conjugacy & the Exponential Family', 'The distributions that make Bayesian updates clean.'),
      soon('change-of-variables', 'Change of Variables', 'How a probability density transforms when you reshape the variable.'),
    ],
  },
  {
    id: 'statistics',
    title: 'Statistics',
    stage: 'Core Math',
    icon: '📊',
    blurb: 'Learning from data: estimation, testing and regression.',
    lessons: [
      soon('descriptive-stats', 'Descriptive Statistics', 'Summarizing data with a few numbers.'),
      soon('mle-map', 'Estimation (MLE & MAP)', 'Choosing the parameters that best explain the data.'),
      soon('confidence-intervals', 'Confidence Intervals', 'Quantifying how sure we are.'),
      soon('hypothesis-testing', 'Hypothesis Testing', 'Deciding whether an effect is real.'),
      soon('regression', 'Regression', 'Fitting lines and curves to data.'),
    ],
  },
  {
    id: 'optimization',
    title: 'Optimization',
    stage: 'Core Math',
    icon: '🎯',
    blurb: 'The capstone: how machines actually learn by minimizing error.',
    lessons: [
      soon('gradient-descent', 'Gradient Descent', 'Rolling downhill to the best answer.'),
      soon('convexity', 'Convexity', 'When downhill always leads to the global best.'),
      soon('constrained-optimization', 'Constrained Optimization', 'Optimizing with rules you must obey.'),
      soon('ml-capstone', 'Capstone: Learning as Optimization', 'Linear regression trained by gradient descent — every idea, together.'),
    ],
  },
  {
    id: 'information-theory',
    title: 'Information Theory',
    stage: 'Core Math',
    icon: 'ℹ️',
    blurb: 'Measuring surprise and information — the source of ML loss functions.',
    lessons: [
      soon('entropy', 'Information & Entropy', 'How many bits does a surprise carry?'),
      soon('cross-entropy-kl', 'Cross-Entropy & KL Divergence', 'Measuring the distance between two distributions — and the loss that trains classifiers.'),
      soon('mutual-information', 'Mutual Information', 'How much knowing one variable tells you about another.'),
      soon('info-theory-ml', 'Information Theory in ML', 'Cross-entropy loss, decision-tree splits and the bottleneck principle.'),
    ],
  },
  {
    id: 'fourier',
    title: 'Fourier & Signals',
    stage: 'Core Math',
    icon: '〜',
    blurb: 'Every signal is a sum of waves — the transform behind audio, images and attention.',
    lessons: [
      soon('sinusoids-frequency', 'Sinusoids, Frequency & Phase', 'The building blocks: amplitude, frequency and phase.'),
      soon('fourier-series', 'Fourier Series', 'Building any repeating signal from sines and cosines.'),
      soon('fourier-transform', 'The Fourier Transform', 'Decomposing any signal into its frequencies.'),
      soon('dft-fft', 'DFT & FFT', 'How computers compute the spectrum — fast.'),
      soon('convolution-theorem', 'The Convolution Theorem', 'Why filtering is just multiplication in frequency space.'),
      soon('fourier-applications', 'Fourier in the Real World & ML', 'Audio, images, spectrograms and positional encodings.'),
    ],
  },
  // ---------------- MACHINE LEARNING ----------------
  {
    id: 'classical-ml',
    title: 'Classical ML Algorithms',
    stage: 'Machine Learning',
    icon: '📈',
    blurb: 'The workhorse algorithms before deep learning — still everywhere in practice.',
    lessons: [
      soon('logistic-regression', 'Logistic Regression', 'Turning a linear score into a probability with the sigmoid.'),
      soon('knn', 'k-Nearest Neighbors', 'Classify by looking at who you are closest to.'),
      soon('decision-trees', 'Decision Trees', 'Splitting data with yes/no questions to maximize information gain.'),
      soon('ensembles-boosting', 'Ensembles & Boosting', 'Random forests and gradient boosting — many weak learners, one strong one.'),
      soon('kmeans', 'k-Means Clustering', 'Finding groups in unlabeled data by minimizing within-cluster distance.'),
      soon('naive-bayes', 'Naive Bayes', 'A fast probabilistic classifier built straight from Bayes’ rule.'),
    ],
  },
  {
    id: 'ml-methods',
    title: 'ML Methods (from the Book)',
    stage: 'Machine Learning',
    icon: '🤖',
    blurb: "The book's central ML problems, where all the foundational math comes together.",
    lessons: [
      soon('when-models-meet-data', 'When Models Meet Data', 'Empirical risk, training vs testing, overfitting and model selection.'),
      soon('gaussian-mixture-models', 'Gaussian Mixture Models', 'Soft clustering and density estimation with the EM algorithm.'),
      soon('support-vector-machines', 'Support Vector Machines', 'Maximum-margin classifiers and the kernel trick.'),
    ],
  },

  // ---------------- DEEP LEARNING ----------------
  {
    id: 'tensors',
    title: 'Tensors & Autodiff',
    stage: 'Deep Learning',
    icon: '🧊',
    blurb: 'The data structures and machinery that make deep learning compute.',
    lessons: [
      soon('tensors', 'Tensors', 'N-dimensional arrays — how data and parameters are stored.'),
      soon('broadcasting-einsum', 'Broadcasting & einsum', 'Operating on whole tensors at once, the index-free way.'),
      soon('computational-graphs', 'Computational Graphs', 'Every model is a graph of operations.'),
      soon('automatic-differentiation', 'Automatic Differentiation', 'How frameworks compute exact gradients automatically.'),
      soon('numerical-stability', 'Numerical Stability', 'The log-sum-exp trick, overflow, and floating-point reality.'),
    ],
  },
  {
    id: 'neural-networks',
    title: 'Neural Networks',
    stage: 'Deep Learning',
    icon: '🧠',
    blurb: 'From a single neuron to deep networks that learn by gradient descent.',
    lessons: [
      soon('the-neuron', 'The Neuron', 'Weighted sum, bias and activation — the unit of computation.'),
      soon('activation-functions', 'Activation Functions', 'Sigmoid, tanh, ReLU, GELU, softmax — and their derivatives.'),
      soon('loss-functions', 'Loss Functions', 'MSE, cross-entropy and the objective the network minimizes.'),
      soon('backpropagation', 'Backpropagation', 'The chain rule, applied layer by layer, end to end.'),
      soon('optimizers', 'Optimizers', 'SGD, momentum, RMSprop and Adam — smarter ways downhill.'),
      soon('initialization', 'Initialization & Vanishing Gradients', 'Why starting weights right keeps signals alive.'),
      soon('regularization', 'Regularization', 'L1/L2 and dropout — fighting overfitting in deep nets.'),
      soon('normalization', 'Normalization', 'Batch and layer normalization — stabilizing training.'),
      soon('convolutional-networks', 'Convolutional Networks', 'Weight sharing and convolution for images.'),
      soon('recurrent-networks', 'Recurrent Networks', 'RNNs, LSTMs and GRUs for sequences.'),
    ],
  },

  // ---------------- LLMs & GENERATIVE AI ----------------
  {
    id: 'transformers',
    title: 'Transformers & LLMs',
    stage: 'LLMs & Generative AI',
    icon: '💬',
    blurb: 'The architecture behind ChatGPT — attention, end to end.',
    lessons: [
      soon('embeddings', 'Embeddings', 'Turning tokens into vectors that carry meaning.'),
      soon('attention', 'Attention (Q, K, V)', 'Scaled dot-product attention — the core operation.'),
      soon('multi-head-attention', 'Multi-Head Attention', 'Many attention heads looking at different relationships.'),
      soon('positional-encoding', 'Positional Encoding', 'Giving a set-based model a sense of order.'),
      soon('softmax-sampling', 'Softmax, Temperature & Sampling', 'How an LLM turns scores into the next token.'),
      soon('layer-norm-residuals', 'Layer Norm & Residual Streams', 'The plumbing that lets deep transformers train.'),
      soon('transformer-block', 'The Transformer Block', 'Assembling attention + MLP into the full block.'),
      soon('language-modeling', 'Language Modeling & Perplexity', 'Next-token prediction, cross-entropy loss and perplexity.'),
      soon('tokenization-scaling', 'Tokenization & Scaling Laws', 'BPE tokens and how performance scales with size and data.'),
    ],
  },
  {
    id: 'generative-models',
    title: 'Generative Models',
    stage: 'LLMs & Generative AI',
    icon: '🎨',
    blurb: 'The math of creating data: sampling, VAEs, diffusion and GANs.',
    lessons: [
      soon('monte-carlo', 'Monte Carlo Methods', 'Estimating the impossible by random sampling.'),
      soon('mcmc', 'Markov Chain Monte Carlo', 'Sampling from distributions you can only evaluate.'),
      soon('reparameterization-trick', 'The Reparameterization Trick', 'Backpropagating through randomness.'),
      soon('vae', 'Variational Autoencoders', 'Encoding to a latent distribution and the ELBO.'),
      soon('diffusion-models', 'Diffusion Models', 'Generating by gradually denoising — the math of Stable Diffusion.'),
      soon('gans', 'GANs', 'A generator and discriminator locked in a minimax game.'),
    ],
  },

  // ---------------- REINFORCEMENT LEARNING ----------------
  {
    id: 'reinforcement-learning',
    title: 'Reinforcement Learning & RLHF',
    stage: 'Reinforcement Learning',
    icon: '🕹️',
    blurb: 'Learning from reward — and how LLMs are aligned with human feedback.',
    lessons: [
      soon('markov-decision-processes', 'Markov Decision Processes', 'States, actions, rewards — the framework of RL.'),
      soon('value-functions', 'Value Functions & Bellman', 'How good is a state? The recursive answer.'),
      soon('q-learning', 'Q-Learning', 'Learning the value of actions from experience.'),
      soon('policy-gradients', 'Policy Gradients', 'Optimizing the policy directly with gradient ascent.'),
      soon('rlhf', 'RLHF, PPO & DPO', 'Aligning LLMs with human feedback — the math of fine-tuning.'),
    ],
  },

  // ============================================================
  //  GAME DEVELOPMENT COURSE
  // ============================================================

  // ---------------- COMPUTER FOUNDATIONS (low-level) ----------------
  {
    id: 'binary-data',
    title: 'Binary & Data Representation',
    stage: 'Computer Foundations',
    icon: '🔟',
    blurb: 'How everything — numbers, text, color — becomes ones and zeros.',
    lessons: [
      soon('bits-bytes', 'Bits & Bytes', 'The atom of computing and how bits group into bytes.'),
      soon('number-systems', 'Number Systems (Binary & Hex)', 'Counting in base 2 and base 16, and why hex is everywhere.'),
      soon('twos-complement', "Two's Complement", 'How computers store negative integers.'),
      soon('floating-point', 'Floating-Point Numbers', 'How real numbers are approximated — and why 0.1 + 0.2 ≠ 0.3.'),
      soon('text-encoding', 'Text Encoding', 'ASCII, Unicode and UTF-8 — turning characters into bytes.'),
    ],
  },
  {
    id: 'memory-hardware',
    title: 'Memory & Hardware',
    stage: 'Computer Foundations',
    icon: '🧠',
    blurb: 'How the machine stores data and runs your code — the part most courses skip.',
    lessons: [
      soon('how-memory-works', 'How Memory Works', 'RAM, addresses and the giant array that is your computer’s memory.'),
      soon('pointers-references', 'Pointers & References', 'Variables that hold addresses — the key to real understanding.'),
      soon('stack-vs-heap', 'Stack vs Heap', 'Two ways memory is organized, and when each is used.'),
      soon('memory-allocation', 'Memory Allocation', 'How the OS and hardware hand out memory — malloc, free and the allocator.'),
      soon('cache-hierarchy', 'Cache & the Memory Hierarchy', 'Why nearby data is fast and random access is slow.'),
      soon('cpu-architecture', 'CPU Architecture', 'Registers, instructions, the clock and the pipeline.'),
      soon('gpu-architecture', 'GPU Architecture', 'Thousands of cores in parallel — why GPUs render graphics.'),
      soon('data-oriented-design', 'Data-Oriented Design', 'Laying out data for the cache — the secret of fast games.'),
    ],
  },

  // ---------------- PROGRAMMING FOUNDATIONS ----------------
  {
    id: 'data-structures',
    title: 'Data Structures',
    stage: 'Programming Foundations',
    icon: '🗂️',
    blurb: 'The containers that hold your game’s data — and how they use memory.',
    lessons: [
      soon('arrays-memory', 'Arrays & Memory Layout', 'Contiguous memory and why arrays are so fast.'),
      soon('dynamic-arrays', 'Dynamic Arrays', 'Growable lists and the cost of resizing.'),
      soon('stacks-queues', 'Stacks & Queues', 'Last-in-first-out and first-in-first-out, and where games use them.'),
      soon('hash-maps', 'Hash Maps', 'Instant lookup by key — hashing and collisions.'),
      soon('trees', 'Trees', 'Hierarchies, from scene graphs to decision trees.'),
      soon('graphs', 'Graphs', 'Nodes and edges — the structure behind maps and AI.'),
    ],
  },
  {
    id: 'algorithms',
    title: 'Algorithms & Complexity',
    stage: 'Programming Foundations',
    icon: '⏱️',
    blurb: 'Doing things efficiently — and knowing how slow your code will get.',
    lessons: [
      soon('big-o', 'Big-O Notation', 'Measuring how runtime grows with input size.'),
      soon('searching', 'Searching', 'Linear vs binary search — the power of sorted data.'),
      soon('sorting', 'Sorting', 'Ordering data, from bubble sort to quicksort.'),
      soon('recursion', 'Recursion', 'Functions that call themselves — and the call stack.'),
      soon('space-time-tradeoffs', 'Space–Time Tradeoffs', 'Trading memory for speed — caching and lookup tables.'),
    ],
  },

  // ---------------- GAME MATH ----------------
  {
    id: 'game-math',
    title: 'Game Math',
    stage: 'Game Math',
    icon: '📐',
    blurb: 'The math that moves, rotates and animates everything on screen.',
    lessons: [
      soon('vectors-in-games', 'Vectors in Games', 'Position, velocity and direction — vectors everywhere.'),
      soon('dot-cross-product', 'Dot & Cross Product', 'Angles, projection and surface normals.'),
      soon('matrices-transforms', 'Matrices & Transforms', 'Translate, rotate and scale with matrices.'),
      soon('coordinate-spaces', 'Coordinate Spaces', 'Local, world, view, clip and screen space.'),
      soon('quaternions', 'Quaternions', 'Smooth 3D rotation without gimbal lock.'),
      soon('angles-rotation', 'Angles & Rotation', 'Radians, headings and rotating toward a target.'),
      soon('interpolation-easing', 'Interpolation & Easing', 'Lerp, slerp, Bézier curves and easing for juicy motion.'),
      soon('random-noise', 'Randomness & Noise', 'PRNGs and Perlin noise for procedural worlds.'),
    ],
  },

  // ---------------- GAME PHYSICS ----------------
  {
    id: 'game-physics',
    title: 'Game Physics',
    stage: 'Game Physics',
    icon: '🍎',
    blurb: 'Making things move, fall, bounce and collide believably.',
    lessons: [
      soon('kinematics', 'Kinematics', 'Position, velocity and acceleration over time.'),
      soon('forces-newton', "Forces & Newton's Laws", 'F = ma, gravity, drag and impulses.'),
      soon('numerical-integration', 'Numerical Integration', 'Euler, semi-implicit and Verlet — stepping physics each frame.'),
      soon('collision-detection', 'Collision Detection', 'AABBs, circles, SAT, and broad vs narrow phase.'),
      soon('collision-response', 'Collision Response', 'Impulses, restitution and friction — making things bounce.'),
      soon('rigid-body-dynamics', 'Rigid-Body Dynamics', 'Rotation, torque and the moment of inertia.'),
      soon('constraints-joints', 'Constraints & Joints', 'Springs, ropes and ragdolls.'),
      soon('particles', 'Particle Systems', 'Thousands of tiny bodies — sparks, smoke and fire.'),
    ],
  },

  // ---------------- GRAPHICS & RENDERING ----------------
  {
    id: 'rendering',
    title: 'Graphics & Rendering',
    stage: 'Graphics & Rendering',
    icon: '🖼️',
    blurb: 'How a 3D scene becomes the pixels on your screen.',
    lessons: [
      soon('rendering-pipeline', 'The Rendering Pipeline', 'From vertices to pixels — the journey of a frame.'),
      soon('rasterization', 'Rasterization', 'Turning triangles into filled pixels.'),
      soon('projection-cameras', 'Projection & Cameras', 'Perspective, orthographic and the view frustum.'),
      soon('shaders', 'Shaders', 'Tiny programs that run per-vertex and per-pixel.'),
      soon('lighting-pbr', 'Lighting & PBR', 'Diffuse, specular and physically based rendering.'),
      soon('textures-uv', 'Textures & UV Mapping', 'Wrapping images onto geometry; sampling and mipmaps.'),
      soon('color-framebuffers', 'Color, Gamma & Framebuffers', 'How color is stored and composited.'),
      soon('ray-tracing', 'Ray Tracing', 'Following rays of light for realistic images.'),
      soon('culling-optimization', 'Culling & Optimization', 'Drawing only what you can see, fast.'),
    ],
  },

  // ---------------- ENGINE ARCHITECTURE ----------------
  {
    id: 'engine',
    title: 'Engine Architecture',
    stage: 'Engine Architecture',
    icon: '⚙️',
    blurb: 'The systems that tie a game together and keep it running smoothly.',
    lessons: [
      soon('game-loop', 'The Game Loop', 'Update and render, fixed timesteps and delta time.'),
      soon('ecs', 'Entity-Component-System', 'A cache-friendly way to organize game objects.'),
      soon('scene-graph', 'Scene Graph & Transforms', 'Parenting objects and combining transforms.'),
      soon('spatial-partitioning', 'Spatial Partitioning', 'Quadtrees, octrees and BVHs for fast queries.'),
      soon('input-time', 'Input & Time', 'Reading the player and keeping consistent timing.'),
      soon('asset-pipeline', 'Asset Pipeline & Serialization', 'Loading, saving and packing game data.'),
      soon('memory-management-games', 'Memory Management for Games', 'Pools and arenas — allocating without stutter.'),
    ],
  },

  // ---------------- GAME AI ----------------
  {
    id: 'game-ai',
    title: 'Game AI',
    stage: 'Game AI',
    icon: '👾',
    blurb: 'Making non-player characters move, decide and feel alive.',
    lessons: [
      soon('pathfinding-astar', 'Pathfinding (A*)', 'Finding the shortest path with Dijkstra and A*.'),
      soon('finite-state-machines', 'Finite State Machines', 'Patrol, chase, flee — states and transitions.'),
      soon('behavior-trees', 'Behavior Trees', 'Composable, scalable decision making.'),
      soon('steering-boids', 'Steering & Boids', 'Seek, flee and flocking for natural movement.'),
      soon('utility-ai', 'Utility & Decision AI', 'Scoring options to pick the best action.'),
    ],
  },

  // ---------------- NETWORKING & ADVANCED ----------------
  {
    id: 'networking',
    title: 'Networking & Multiplayer',
    stage: 'Networking & Advanced',
    icon: '🌐',
    blurb: 'Letting many players share one world across the internet.',
    lessons: [
      soon('networking-basics', 'Networking Basics', 'TCP vs UDP, packets and latency.'),
      soon('client-server-p2p', 'Client-Server vs P2P', 'Architectures for multiplayer games.'),
      soon('client-prediction', 'Client Prediction & Reconciliation', 'Hiding latency so controls feel instant.'),
      soon('lag-compensation', 'Lag Compensation & Interpolation', 'Making other players move smoothly.'),
      soon('state-synchronization', 'State Synchronization', 'Keeping every machine’s world in agreement.'),
    ],
  },
  {
    id: 'audio-performance',
    title: 'Audio & Performance',
    stage: 'Networking & Advanced',
    icon: '🔊',
    blurb: 'Sound, profiling and squeezing every millisecond out of a frame.',
    lessons: [
      soon('game-audio', 'Game Audio & DSP', 'Sound waves, mixing and spatial audio.'),
      soon('performance-profiling', 'Performance & Profiling', 'The frame budget and finding bottlenecks.'),
      soon('procedural-generation', 'Procedural Generation', 'Building worlds with algorithms.'),
      soon('optimization-techniques', 'Optimization Techniques', 'Batching, LOD and doing less work.'),
    ],
  },

  // ============================================================
  //  DATA STRUCTURES & ALGORITHMS COURSE
  // ============================================================

  // ---------------- DSA FOUNDATIONS ----------------
  {
    id: 'dsa-complexity',
    title: 'Complexity & Big-O',
    stage: 'DSA Foundations',
    icon: '⏱️',
    blurb: 'The language for talking about speed and memory — how runtime grows as data grows.',
    lessons: [
      soon('big-o-intro', 'What Is Big-O?', 'Measuring how an algorithm scales, ignoring the constants.'),
      soon('complexity-classes', 'The Complexity Zoo', 'O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ), O(n!) — what each feels like.'),
      soon('analyzing-algorithms', 'Analyzing Real Code', 'Counting operations in loops, nested loops and recursion.'),
      soon('space-amortized', 'Space & Amortized Analysis', 'Memory cost, and why a doubling array is O(1) on average.'),
    ],
  },
  {
    id: 'dsa-recursion',
    title: 'Recursion',
    stage: 'DSA Foundations',
    icon: '🌀',
    blurb: 'Functions that call themselves — the call stack, base cases and recursion trees.',
    lessons: [
      soon('recursion-basics', 'Thinking Recursively', 'Base case + recursive case, and how the call stack unwinds.'),
      soon('factorial-power', 'Factorial & Fast Power', 'Two classic recursions — and exponentiation by squaring.'),
      soon('fibonacci-recursion', 'Fibonacci & the Recursion Tree', 'Why naive recursion explodes, and how memoization tames it.'),
      soon('tower-of-hanoi', 'Tower of Hanoi', 'The puzzle that makes recursion click — and its 2ⁿ−1 cost.'),
      soon('recursion-vs-iteration', 'Recursion vs Iteration', 'Tail calls, stack depth, and converting one to the other.'),
    ],
  },
  {
    id: 'dsa-bit-manipulation',
    title: 'Bit Manipulation',
    stage: 'DSA Foundations',
    icon: '🔣',
    blurb: 'Working directly with the ones and zeros — fast tricks every competitive coder knows.',
    lessons: [
      soon('bit-basics', 'Bitwise Operators', 'AND, OR, XOR, NOT and shifts — the six core operations.'),
      soon('bit-tricks', 'Essential Bit Tricks', 'Get/set/clear/toggle a bit, check powers of two, isolate the lowest set bit.'),
      soon('counting-bits', 'Counting Set Bits', 'Popcount, Brian Kernighan’s trick and lookup tables.'),
      soon('flags-masks', 'Flags & Bitmasks', 'Packing booleans into one integer — permissions, colors and feature sets.'),
      soon('xor-single-number', 'The Magic of XOR', 'Finding the unique number, swapping without a temp, and parity.'),
      soon('bitmask-dp', 'Bitmask Dynamic Programming', 'Using an integer as a subset — the traveling-salesman trick.'),
    ],
  },

  // ---------------- CORE DATA STRUCTURES ----------------
  {
    id: 'dsa-arrays',
    title: 'Arrays & Two Pointers',
    stage: 'Core Data Structures',
    icon: '📊',
    blurb: 'The most fundamental container — and the pointer techniques that make it powerful.',
    lessons: [
      soon('array-basics', 'Array Fundamentals', 'Contiguous memory, O(1) access, and the cost of insert/delete.'),
      soon('two-pointers', 'The Two-Pointer Technique', 'Two indices walking an array — pair sums, reversing, partitioning.'),
      soon('sliding-window', 'Sliding Window', 'A moving sub-array for max-sum, longest-substring and more.'),
      soon('kadane', 'Kadane’s Algorithm', 'Maximum subarray sum in a single linear pass.'),
    ],
  },
  {
    id: 'dsa-strings',
    title: 'Strings',
    stage: 'Core Data Structures',
    icon: '🔤',
    blurb: 'Text processing — reversal, palindromes, anagrams and fast pattern matching.',
    lessons: [
      soon('string-basics', 'String Fundamentals', 'Immutability, char codes, and the cost of common operations.'),
      soon('string-reversal', 'Reversing & Rotating', 'In-place reversal with two pointers and the rotation trick.'),
      soon('palindromes', 'Palindromes', 'Detecting and building palindromes from both ends.'),
      soon('anagrams', 'Anagrams', 'Comparing strings by character frequency.'),
      soon('pattern-matching-kmp', 'Pattern Matching (KMP)', 'Finding a needle in a haystack in linear time with the failure function.'),
    ],
  },
  {
    id: 'dsa-linked-lists',
    title: 'Linked Lists',
    stage: 'Core Data Structures',
    icon: '🔗',
    blurb: 'Nodes joined by pointers — O(1) insertion and the classic interview manipulations.',
    lessons: [
      soon('singly-linked-list', 'Singly Linked Lists', 'Nodes, the head pointer, and traversal.'),
      soon('linked-list-operations', 'Reversal & Cycle Detection', 'Reverse a list in place and find a loop with fast/slow pointers.'),
      soon('doubly-linked-list', 'Doubly Linked Lists', 'Backward links — and why LRU caches love them.'),
      soon('circular-linked-list', 'Circular Linked Lists', 'A tail that points home — round-robin and the Josephus problem.'),
    ],
  },
  {
    id: 'dsa-stacks',
    title: 'Stacks',
    stage: 'Core Data Structures',
    icon: '🥞',
    blurb: 'Last-in, first-out — the structure behind undo, the call stack and expression parsing.',
    lessons: [
      soon('stack-basics', 'The Stack (LIFO)', 'Push, pop, peek — and the two ways to implement it.'),
      soon('balanced-parentheses', 'Balanced Brackets', 'The canonical stack problem — matching every open with a close.'),
      soon('stack-applications', 'Expression Evaluation', 'Postfix evaluation, infix conversion and the monotonic stack.'),
    ],
  },
  {
    id: 'dsa-queues',
    title: 'Queues',
    stage: 'Core Data Structures',
    icon: '🎟️',
    blurb: 'First-in, first-out — buffers, scheduling and breadth-first traversal.',
    lessons: [
      soon('queue-basics', 'The Queue (FIFO)', 'Enqueue, dequeue, and array vs linked implementations.'),
      soon('circular-queue', 'Circular Queue', 'Wrapping a fixed array into a ring buffer.'),
      soon('deque', 'Deques', 'A double-ended queue — push and pop at both ends.'),
      soon('priority-queue', 'Priority Queues', 'Serving the most urgent item first — the heap’s front door.'),
    ],
  },
  {
    id: 'dsa-hash-tables',
    title: 'Hash Tables',
    stage: 'Core Data Structures',
    icon: '🗃️',
    blurb: 'Near-instant lookup by key — hashing, collisions and the patterns they unlock.',
    lessons: [
      soon('hash-functions', 'Hash Functions', 'Turning any key into an array index — uniformly and fast.'),
      soon('hash-table-basics', 'Building a Hash Table', 'Buckets, load factor and resizing.'),
      soon('collision-handling', 'Collision Handling', 'Chaining vs open addressing when two keys collide.'),
      soon('hashmap-patterns', 'Hash-Map Problem Patterns', 'Frequency counts, seen-sets and the two-sum trick.'),
    ],
  },
  {
    id: 'dsa-trees',
    title: 'Trees & BSTs',
    stage: 'Core Data Structures',
    icon: '🌳',
    blurb: 'Hierarchies of nodes — traversals, binary search trees and self-balancing.',
    lessons: [
      soon('tree-basics', 'Tree Fundamentals', 'Roots, children, height and the binary tree.'),
      soon('tree-traversals', 'Tree Traversals', 'Pre-, in-, post-order and level-order — depth vs breadth.'),
      soon('binary-search-tree', 'Binary Search Trees', 'Ordered trees with O(log n) search, insert and delete.'),
      soon('avl-tree', 'AVL Trees', 'Keeping a BST balanced with rotations — guaranteed O(log n).'),
    ],
  },
  {
    id: 'dsa-heaps',
    title: 'Heaps',
    stage: 'Core Data Structures',
    icon: '⛰️',
    blurb: 'A tree-shaped array that always knows its smallest (or largest) element.',
    lessons: [
      soon('heap-basics', 'The Binary Heap', 'A complete tree in an array — parent/child by index.'),
      soon('heap-operations', 'Sift-Up, Sift-Down & Build-Heap', 'How insert, extract and heapify keep the order invariant.'),
      soon('heap-applications', 'Heaps at Work', 'Top-K, running medians and the priority queue.'),
    ],
  },
  {
    id: 'dsa-tries',
    title: 'Tries',
    stage: 'Core Data Structures',
    icon: '🌲',
    blurb: 'Prefix trees that store strings by their shared beginnings — the autocomplete engine.',
    lessons: [
      soon('trie-basics', 'The Prefix Tree', 'One node per character — insert, search and prefix queries.'),
      soon('trie-autocomplete', 'Autocomplete & Word Search', 'Walking a trie to suggest, complete and validate words.'),
    ],
  },

  // ---------------- SORTING & SEARCHING ----------------
  {
    id: 'dsa-sorting',
    title: 'Sorting',
    stage: 'Sorting & Searching',
    icon: '🔀',
    blurb: 'Ordering data — from O(n²) simple sorts to O(n log n) workhorses and linear-time tricks.',
    lessons: [
      soon('bubble-sort', 'Bubble Sort', 'Repeatedly swapping neighbors — the simplest (and slowest) sort.'),
      soon('selection-sort', 'Selection Sort', 'Find the minimum, put it in place, repeat.'),
      soon('insertion-sort', 'Insertion Sort', 'Building a sorted region one card at a time — great on nearly-sorted data.'),
      soon('merge-sort', 'Merge Sort', 'Divide, sort halves, and merge — guaranteed O(n log n).'),
      soon('quick-sort', 'Quicksort', 'Partition around a pivot — the fastest sort in practice.'),
      soon('heap-sort', 'Heap Sort', 'Sorting in place by repeatedly extracting from a heap.'),
      soon('counting-radix-sort', 'Counting & Radix Sort', 'Beating O(n log n) when the keys are small integers.'),
      soon('sorting-comparison', 'Choosing a Sort', 'Stability, space, and why your language uses Timsort.'),
    ],
  },
  {
    id: 'dsa-searching',
    title: 'Searching',
    stage: 'Sorting & Searching',
    icon: '🔍',
    blurb: 'Finding an element fast — and the binary-search idea that appears everywhere.',
    lessons: [
      soon('linear-search', 'Linear Search', 'Check every element — the O(n) baseline and when it’s the right call.'),
      soon('binary-search', 'Binary Search', 'Halving the search space each step — O(log n) on sorted data.'),
      soon('binary-search-variations', 'Binary Search Variations', 'Lower/upper bound, first/last occurrence and search on the answer.'),
      soon('jump-exponential-search', 'Jump & Exponential Search', 'Block jumps and doubling ranges for unbounded or block data.'),
      soon('ternary-search', 'Ternary Search', 'Finding the peak of a unimodal function.'),
    ],
  },

  // ---------------- GRAPHS & NETWORKS ----------------
  {
    id: 'dsa-graphs',
    title: 'Graphs',
    stage: 'Graphs & Networks',
    icon: '🕸️',
    blurb: 'Nodes and edges — traversal, shortest paths, spanning trees and ordering.',
    lessons: [
      soon('graph-representations', 'Representing Graphs', 'Adjacency lists vs matrices, directed vs weighted.'),
      soon('bfs', 'Breadth-First Search', 'Exploring level by level with a queue — shortest paths on unweighted graphs.'),
      soon('dfs', 'Depth-First Search', 'Going deep with a stack or recursion — and what it reveals.'),
      soon('cycle-detection', 'Cycle Detection', 'Spotting loops in directed and undirected graphs.'),
      soon('topological-sort', 'Topological Sort', 'Ordering tasks that depend on each other.'),
      soon('union-find', 'Union-Find', 'Disjoint sets with path compression — connectivity in near-O(1).'),
      soon('mst', 'Minimum Spanning Trees', 'Connecting everything for the least cost — Kruskal and Prim.'),
      soon('dijkstra', 'Dijkstra’s Algorithm', 'Shortest paths from a source with non-negative weights.'),
      soon('bellman-ford-floyd', 'Bellman-Ford & Floyd-Warshall', 'Negative edges and all-pairs shortest paths.'),
      soon('a-star', 'A* Search', 'Dijkstra plus a heuristic — the pathfinder games use.'),
    ],
  },
  {
    id: 'dsa-advanced-graph',
    title: 'Advanced Graph Algorithms',
    stage: 'Graphs & Networks',
    icon: '🌐',
    blurb: 'Connectivity, matching and flow — the deep theory of graphs.',
    lessons: [
      soon('strongly-connected-components', 'Strongly Connected Components', 'Tarjan’s and Kosaraju’s — finding mutually reachable groups.'),
      soon('articulation-bridges', 'Articulation Points & Bridges', 'The critical nodes and edges that hold a network together.'),
      soon('eulerian-path', 'Eulerian Paths', 'Crossing every edge exactly once — the Königsberg bridges.'),
      soon('bipartite-matching', 'Bipartite Matching', 'Pairing two sides optimally — Hopcroft-Karp and augmenting paths.'),
      soon('max-flow-min-cut', 'Max-Flow / Min-Cut', 'Pushing as much as possible through a network — and the theorem that bounds it.'),
      soon('two-sat', '2-SAT', 'Solving boolean constraints with an implication graph.'),
    ],
  },
  {
    id: 'dsa-graph-networks',
    title: 'Network Science Algorithms',
    stage: 'Graphs & Networks',
    icon: '📡',
    blurb: 'Ranking and community detection on huge real-world networks.',
    lessons: [
      soon('pagerank', 'PageRank', 'Ranking pages by the random-surfer model — the eigenvector of the web.'),
      soon('hits', 'HITS (Hubs & Authorities)', 'Two-sided importance — who points, and who is pointed to.'),
      soon('community-louvain', 'Community Detection (Louvain)', 'Finding clusters by maximizing modularity.'),
      soon('girvan-newman', 'Girvan-Newman', 'Splitting a network by removing its most-between edges.'),
      soon('label-propagation', 'Label Propagation', 'Communities emerging from local majority voting.'),
    ],
  },
  {
    id: 'dsa-network-algorithms',
    title: 'Network Algorithms',
    stage: 'Graphs & Networks',
    icon: '🔌',
    blurb: 'How real networks route, stay reliable and model social structure.',
    lessons: [
      soon('network-routing', 'Network Routing', 'How packets find their way — distance-vector and link-state.'),
      soon('network-flow-app', 'Network Flow in Practice', 'Bandwidth, bipartite assignment and circulation.'),
      soon('network-reliability', 'Network Reliability', 'Redundancy, min-cuts and surviving failures.'),
      soon('network-topology', 'Network Topology', 'Stars, meshes and trees — and their trade-offs.'),
      soon('social-network-analysis', 'Social Network Analysis', 'Centrality, triadic closure and influence.'),
    ],
  },

  // ---------------- ALGORITHM PARADIGMS ----------------
  {
    id: 'dsa-dynamic-programming',
    title: 'Dynamic Programming',
    stage: 'Algorithm Paradigms',
    icon: '🧮',
    blurb: 'Solving overlapping subproblems once — memoization, tabulation and the classics.',
    lessons: [
      soon('dp-intro', 'What Is Dynamic Programming?', 'Optimal substructure, overlapping subproblems and the two styles.'),
      soon('fibonacci-memoization', 'Memoization vs Tabulation', 'Top-down caching and bottom-up tables on Fibonacci.'),
      soon('coin-change', 'Coin Change', 'Fewest coins and counting ways — the unbounded-knapsack family.'),
      soon('knapsack', '0/1 Knapsack', 'Maximizing value under a weight limit — the canonical DP.'),
      soon('lcs', 'Longest Common Subsequence', 'Diffing two sequences with a 2-D table.'),
      soon('lis', 'Longest Increasing Subsequence', 'O(n²) DP and the O(n log n) patience-sorting trick.'),
    ],
  },
  {
    id: 'dsa-greedy',
    title: 'Greedy Algorithms',
    stage: 'Algorithm Paradigms',
    icon: '💰',
    blurb: 'Taking the locally best choice — and knowing when that’s globally optimal.',
    lessons: [
      soon('greedy-intro', 'The Greedy Strategy', 'When local optimum equals global — the exchange argument.'),
      soon('activity-selection', 'Activity Selection', 'Scheduling the most non-overlapping events.'),
      soon('fractional-knapsack', 'Fractional Knapsack', 'When you can take pieces, greed by value-density wins.'),
      soon('interval-scheduling', 'Interval Scheduling & Merging', 'Sorting by endpoint to pack or merge intervals.'),
      soon('job-sequencing', 'Job Sequencing with Deadlines', 'Maximizing profit before time runs out.'),
      soon('huffman-coding', 'Huffman Coding', 'Optimal prefix codes — the heart of file compression.'),
    ],
  },
  {
    id: 'dsa-backtracking',
    title: 'Backtracking',
    stage: 'Algorithm Paradigms',
    icon: '♟️',
    blurb: 'Building solutions step by step and undoing dead ends — the search-tree paradigm.',
    lessons: [
      soon('backtracking-intro', 'The Backtracking Template', 'Choose, explore, un-choose — pruning the search tree.'),
      soon('permutations', 'Permutations', 'Generating every ordering by swapping and recursing.'),
      soon('combinations', 'Combinations & Subsets', 'Choosing k from n without repeats.'),
      soon('n-queens-sudoku', 'N-Queens & Sudoku', 'Constraint satisfaction — placing pieces that don’t conflict.'),
      soon('string-backtracking', 'String Backtracking', 'Partitions, parentheses and word breaks.'),
    ],
  },
  {
    id: 'dsa-dp-optimization',
    title: 'DP Optimization',
    stage: 'Algorithm Paradigms',
    icon: '🚀',
    blurb: 'Advanced DP — on trees, over digits, over subsets, and asymptotic speed-ups.',
    lessons: [
      soon('dp-on-trees', 'DP on Trees', 'Rerooting and subtree aggregation — DP without a grid.'),
      soon('digit-dp', 'Digit DP', 'Counting numbers with a property by building them digit by digit.'),
      soon('profile-bitmask-dp', 'Bitmask & Profile DP', 'Packing a row’s state into bits to tile and cover.'),
      soon('divide-conquer-dp', 'Divide & Conquer Optimization', 'Cutting a quadratic DP to O(n log n).'),
      soon('convex-hull-trick', 'Convex Hull Trick', 'Querying many lines fast to speed up DP transitions.'),
      soon('sos-dp', 'Sum-over-Subsets DP', 'Aggregating over every subset in O(n·2ⁿ).'),
    ],
  },

  // ---------------- ADVANCED ALGORITHMS & STRUCTURES ----------------
  {
    id: 'dsa-advanced-algorithms',
    title: 'Range Structures',
    stage: 'Advanced Algorithms & Structures',
    icon: '📐',
    blurb: 'Answering range queries fast — Fenwick trees, segment trees and friends.',
    lessons: [
      soon('fenwick-tree', 'Fenwick (Binary Indexed) Tree', 'Prefix sums with point updates in O(log n) using bit magic.'),
      soon('segment-tree', 'Segment Trees', 'Range query and update — sums, mins, and lazy propagation.'),
      soon('math-algorithms', 'Fast Math Building Blocks', 'Fast exponentiation, GCD and modular inverses for algorithms.'),
      soon('heuristic-algorithms', 'Heuristics & Local Search', 'Hill climbing, simulated annealing and good-enough answers.'),
    ],
  },
  {
    id: 'dsa-advanced-trees',
    title: 'Advanced Trees',
    stage: 'Advanced Algorithms & Structures',
    icon: '🌴',
    blurb: 'Self-balancing and decomposition trees that power databases and competitive programming.',
    lessons: [
      soon('red-black-tree', 'Red-Black Trees', 'The balanced BST behind language standard libraries.'),
      soon('b-tree', 'B-Trees', 'Wide, shallow trees built for disk and databases.'),
      soon('splay-treap', 'Splay Trees & Treaps', 'Self-adjusting and randomized balanced trees.'),
      soon('lca', 'Lowest Common Ancestor', 'Binary lifting and Euler-tour + RMQ.'),
      soon('heavy-light-decomposition', 'Heavy-Light Decomposition', 'Turning tree paths into array ranges.'),
      soon('centroid-decomposition', 'Centroid Decomposition', 'Divide and conquer on trees.'),
    ],
  },
  {
    id: 'dsa-advanced-structures',
    title: 'Advanced Data Structures',
    stage: 'Advanced Algorithms & Structures',
    icon: '🧱',
    blurb: 'Probabilistic, persistent and specialized structures beyond the textbook basics.',
    lessons: [
      soon('skip-list', 'Skip Lists', 'A linked list with express lanes — O(log n) without rotations.'),
      soon('bloom-filter', 'Bloom Filters', 'Probabilistic membership in tiny space — maybe yes, definitely no.'),
      soon('sparse-table', 'Sparse Tables', 'O(1) range minimums on static arrays.'),
      soon('suffix-tree', 'Suffix Trees & Arrays', 'Indexing every suffix for instant substring queries.'),
      soon('persistent-data-structures', 'Persistent Data Structures', 'Keeping every past version by sharing structure.'),
      soon('rope', 'Ropes', 'A tree of strings for fast edits on huge text.'),
    ],
  },
  {
    id: 'dsa-modern-structures',
    title: 'Modern Data Structures',
    stage: 'Advanced Algorithms & Structures',
    icon: '💾',
    blurb: 'The structures behind modern databases and similarity search.',
    lessons: [
      soon('lsm-tree', 'LSM Trees', 'Write-optimized storage — the engine inside LevelDB and Cassandra.'),
      soon('locality-sensitive-hashing', 'Locality-Sensitive Hashing', 'Hashing so that similar items collide — fast nearest-neighbor search.'),
    ],
  },
  {
    id: 'dsa-string-algorithms',
    title: 'String Algorithms',
    stage: 'Advanced Algorithms & Structures',
    icon: '🧵',
    blurb: 'Industrial-strength text search — linear-time matching and hashing.',
    lessons: [
      soon('z-algorithm', 'The Z-Algorithm', 'Prefix-match lengths in linear time.'),
      soon('rabin-karp', 'Rabin-Karp & Rolling Hashes', 'Matching by hashing a sliding window.'),
      soon('boyer-moore', 'Boyer-Moore', 'Skipping ahead — the algorithm in grep.'),
      soon('manacher', 'Manacher’s Algorithm', 'Every palindromic substring in linear time.'),
      soon('aho-corasick', 'Aho-Corasick', 'Matching many patterns at once with a trie of failure links.'),
      soon('suffix-array', 'Suffix Arrays', 'A sorted list of suffixes for powerful string queries.'),
    ],
  },
  {
    id: 'dsa-regex',
    title: 'Regular Expressions',
    stage: 'Advanced Algorithms & Structures',
    icon: '🔎',
    blurb: 'The pattern language — from basic syntax to the automaton that runs it.',
    lessons: [
      soon('regex-basics', 'Regex Fundamentals', 'Literals, the dot, and the building blocks of patterns.'),
      soon('character-classes', 'Character Classes & Anchors', 'Sets, ranges, \\d/\\w/\\s and matching positions.'),
      soon('quantifiers', 'Quantifiers', 'Greedy, lazy and possessive repetition.'),
      soon('groups-capturing', 'Groups & Backreferences', 'Capturing, alternation and reusing matches.'),
      soon('lookarounds', 'Lookaheads & Lookbehinds', 'Zero-width assertions that match without consuming.'),
      soon('regex-engine', 'How a Regex Engine Works', 'Compiling a pattern to an NFA and the catastrophic-backtracking trap.'),
    ],
  },
  {
    id: 'dsa-misc-algorithms',
    title: 'Essential Techniques',
    stage: 'Advanced Algorithms & Structures',
    icon: '🛠️',
    blurb: 'The clever tricks that turn impossible limits into passing solutions.',
    lessons: [
      soon('quickselect', 'Quickselect', 'The k-th smallest element in O(n) average — partition without full sort.'),
      soon('sqrt-decomposition', 'Square-Root Decomposition', 'Splitting an array into √n blocks for balanced queries.'),
      soon('mos-algorithm', 'Mo’s Algorithm', 'Reordering offline queries to answer ranges fast.'),
      soon('meet-in-the-middle', 'Meet in the Middle', 'Halving an exponential search by combining two halves.'),
      soon('coordinate-compression', 'Coordinate Compression', 'Shrinking huge values to small indices.'),
      soon('reservoir-sampling', 'Reservoir Sampling', 'A uniform random sample from an unbounded stream.'),
    ],
  },

  // ---------------- MATH & SPECIALIZED ----------------
  {
    id: 'dsa-number-theory',
    title: 'Number Theory',
    stage: 'Math & Specialized Algorithms',
    icon: '🔢',
    blurb: 'The math of integers — modular arithmetic, primes and the fast Fourier transform.',
    lessons: [
      soon('modular-arithmetic', 'Modular Arithmetic', 'Clock math — addition, multiplication and modular inverses.'),
      soon('gcd-euclidean', 'GCD & Extended Euclidean', 'The oldest algorithm — and solving ax + by = gcd.'),
      soon('primality-tests', 'Primality Testing', 'Trial division, Fermat and Miller-Rabin.'),
      soon('sieve-eratosthenes', 'Sieves', 'Listing all primes up to n — and the linear sieve.'),
      soon('euler-totient', 'Euler’s Totient & Theorem', 'Counting coprimes — the math behind RSA.'),
      soon('fft-ntt', 'FFT & NTT', 'Multiplying polynomials and big numbers in O(n log n).'),
    ],
  },
  {
    id: 'dsa-geometry',
    title: 'Computational Geometry',
    stage: 'Math & Specialized Algorithms',
    icon: '📏',
    blurb: 'Algorithms on points, lines and polygons — orientation, hulls and sweeps.',
    lessons: [
      soon('geometry-primitives', 'Geometry Primitives', 'Cross products, orientation and which side of a line.'),
      soon('line-intersection', 'Segment Intersection', 'Do two segments cross? The orientation test.'),
      soon('convex-hull', 'Convex Hull', 'The tightest rubber band around a point set — Graham scan & Andrew’s.'),
      soon('point-in-polygon', 'Point in Polygon', 'Ray casting and the winding number.'),
      soon('closest-pair', 'Closest Pair of Points', 'Divide and conquer down to O(n log n).'),
      soon('line-sweep', 'Line Sweep', 'A moving line that turns 2-D problems into 1-D events.'),
    ],
  },
  {
    id: 'dsa-compression',
    title: 'Compression',
    stage: 'Math & Specialized Algorithms',
    icon: '🗜️',
    blurb: 'Shrinking data — the algorithms inside zip, PNG and modern codecs.',
    lessons: [
      soon('compression-basics', 'How Compression Works', 'Entropy, redundancy, and lossless vs lossy.'),
      soon('lz-family', 'LZ77 & LZ4', 'Replacing repeats with back-references — the dictionary approach.'),
      soon('zstandard', 'Zstandard', 'Modern compression — LZ plus entropy coding, tuned for speed.'),
      soon('brotli', 'Brotli', 'The web’s compressor — a built-in dictionary and context modeling.'),
    ],
  },
  {
    id: 'dsa-quantum',
    title: 'Quantum Algorithms',
    stage: 'Math & Specialized Algorithms',
    icon: '⚛️',
    blurb: 'Computing with qubits — superposition, interference and the famous speed-ups.',
    lessons: [
      soon('qubits-superposition', 'Qubits & Superposition', 'A bit that is 0 and 1 at once — amplitudes and measurement.'),
      soon('quantum-gates', 'Quantum Gates & Circuits', 'Hadamard, CNOT and building reversible computations.'),
      soon('grover-shor', 'Grover & Shor', 'Quadratic search speed-up and factoring that breaks RSA.'),
    ],
  },

  // ---------------- APPLIED ALGORITHMS & SYSTEMS ----------------
  {
    id: 'dsa-ml-algorithms',
    title: 'ML Algorithms',
    stage: 'Applied Algorithms & Systems',
    icon: '🤖',
    blurb: 'The algorithms inside modern AI — attention, transformers, diffusion and more.',
    lessons: [
      soon('attention', 'Attention', 'Scaled dot-product attention — the core of the transformer.'),
      soon('transformers', 'Transformers', 'Assembling attention and MLPs into the architecture behind LLMs.'),
      soon('graph-neural-networks', 'Graph Neural Networks', 'Message passing — deep learning on graphs.'),
      soon('diffusion-models', 'Diffusion Models', 'Generating images by learning to denoise.'),
      soon('optimizers', 'Optimizers', 'SGD, momentum and Adam — how models actually learn.'),
      soon('embeddings', 'Embeddings & Vector Search', 'Turning items into vectors and finding nearest neighbors.'),
    ],
  },
  {
    id: 'dsa-computer-vision',
    title: 'Computer Vision',
    stage: 'Applied Algorithms & Systems',
    icon: '👁️',
    blurb: 'Object detection from first principles — IoU, anchors and the YOLO family.',
    lessons: [
      soon('cv-foundations', 'Detection Foundations', 'Bounding boxes, IoU and non-max suppression.'),
      soon('backbones-fpn', 'Backbones & Feature Pyramids', 'Multi-scale features for detecting objects big and small.'),
      soon('rcnn-detectors', 'R-CNN to Faster R-CNN', 'Region proposals and two-stage detection.'),
      soon('yolo-family', 'The YOLO Family', 'One-stage real-time detection from v1 to today.'),
      soon('segmentation-pose', 'Segmentation & Pose', 'Per-pixel masks and keypoint estimation.'),
    ],
  },
  {
    id: 'dsa-3d-graphics',
    title: '3D Graphics',
    stage: 'Applied Algorithms & Systems',
    icon: '🎲',
    blurb: 'The algorithms that render 3D worlds — transforms, acceleration and shading.',
    lessons: [
      soon('3d-math', '3D Math', 'Matrices, quaternions and the transform pipeline.'),
      soon('rendering-pipeline', 'The Rendering Pipeline', 'From vertices to pixels — projection and rasterization.'),
      soon('spatial-acceleration', 'Spatial Acceleration', 'BVHs, octrees and frustum culling for fast scenes.'),
      soon('raycasting', 'Raycasting & Intersection', 'Shooting rays to pick objects and trace light.'),
      soon('shading-lighting', 'Shading & Lighting', 'Normals, the BRDF and physically based rendering.'),
      soon('curves-animation', 'Curves & Animation', 'Bézier and Catmull-Rom curves, and skeletal animation.'),
    ],
  },
  {
    id: 'dsa-system-design',
    title: 'System Design',
    stage: 'Applied Algorithms & Systems',
    icon: '🏗️',
    blurb: 'Putting algorithms to work at scale — caching, sharding and distributed systems.',
    lessons: [
      soon('system-design-fundamentals', 'System Design Fundamentals', 'Latency, throughput, and the back-of-envelope numbers.'),
      soon('caching-load-balancing', 'Caching & Load Balancing', 'Consistent hashing, eviction policies and spreading load.'),
      soon('databases-storage', 'Databases & Storage', 'SQL vs NoSQL, indexing, replication and sharding.'),
      soon('distributed-systems', 'Distributed Systems', 'Consensus, the CAP theorem and eventual consistency.'),
      soon('scalability', 'Designing for Scale', 'Queues, rate limiting and building a real system end to end.'),
    ],
  },
];

// ---- Derived helpers -------------------------------------------------

export interface FlatLesson extends LessonMeta {
  slug: string;        // "<trackId>/<lessonId>"
  trackId: string;
  trackTitle: string;
  trackIcon: string;
  stage: string;
  course: CourseId;
}

export const ALL_LESSONS: FlatLesson[] = TRACKS.flatMap((t) =>
  t.lessons.map((l) => ({
    ...l,
    slug: `${t.id}/${l.id}`,
    trackId: t.id,
    trackTitle: t.title,
    trackIcon: t.icon,
    stage: t.stage,
    course: courseOfStage(t.stage),
  })),
);

export function courseOfSlug(slug: string): CourseId {
  return getLessonBySlug(slug)?.course ?? 'ml';
}

/** Tracks belonging to a course, in curriculum order. */
export function tracksForCourse(course: CourseId): Track[] {
  return TRACKS.filter((t) => courseOfStage(t.stage) === course);
}

export function getLessonBySlug(slug: string): FlatLesson | undefined {
  return ALL_LESSONS.find((l) => l.slug === slug);
}

export function getTrack(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}

/** Previous / next lesson — scoped to the same course. */
export function getNeighbors(slug: string): { prev?: FlatLesson; next?: FlatLesson } {
  const lesson = getLessonBySlug(slug);
  if (!lesson) return {};
  const within = ALL_LESSONS.filter((l) => l.course === lesson.course);
  const i = within.findIndex((l) => l.slug === slug);
  return {
    prev: i > 0 ? within[i - 1] : undefined,
    next: i < within.length - 1 ? within[i + 1] : undefined,
  };
}

export const READY_COUNT = ALL_LESSONS.filter((l) => l.status === 'ready').length;
export const TOTAL_COUNT = ALL_LESSONS.length;
