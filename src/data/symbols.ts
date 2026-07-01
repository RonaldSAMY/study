/* ============================================================
   Math symbols & notation reference — faithful to the "Table of Symbols"
   in Mathematics for Machine Learning (Deisenroth, Faisal & Ong), with
   clearer, beginner-friendly explanations. Rendered by /symbols.
   `tex` is a KaTeX string; `name` is a short label; `meaning` explains it.
   ============================================================ */

export interface Sym {
  tex: string;
  name: string;
  meaning: string;
}
export interface SymGroup {
  title: string;
  blurb: string;
  symbols: Sym[];
}

export const SYMBOL_GROUPS: SymGroup[] = [
  {
    title: 'How things are written (conventions)',
    blurb: 'The font/case tells you what kind of object something is — learn this first and formulas stop looking scary.',
    symbols: [
      { tex: 'a,\\ b,\\ c,\\ \\alpha,\\ \\beta,\\ \\gamma', name: 'Scalars', meaning: 'Single numbers are written lowercase (often italic Latin or Greek letters).' },
      { tex: '\\boldsymbol{x},\\ \\boldsymbol{y},\\ \\boldsymbol{z}', name: 'Vectors', meaning: 'Vectors are bold lowercase — a list of numbers, e.g. a point or a direction.' },
      { tex: '\\boldsymbol{A},\\ \\boldsymbol{B},\\ \\boldsymbol{C}', name: 'Matrices', meaning: 'Matrices are bold uppercase — a grid (table) of numbers.' },
      { tex: '(\\boldsymbol{b}_1, \\boldsymbol{b}_2, \\boldsymbol{b}_3)', name: 'Ordered tuple', meaning: 'Round brackets: an ordered list where position matters.' },
      { tex: '[\\boldsymbol{b}_1, \\boldsymbol{b}_2, \\boldsymbol{b}_3]', name: 'Matrix of columns', meaning: 'Square brackets: vectors stacked side-by-side as the columns of a matrix.' },
      { tex: '\\{\\boldsymbol{b}_1, \\boldsymbol{b}_2, \\boldsymbol{b}_3\\}', name: 'Set of vectors', meaning: 'Curly braces: an unordered collection (no repeats, order ignored).' },
    ],
  },
  {
    title: 'Number sets',
    blurb: 'The "worlds" a number can live in.',
    symbols: [
      { tex: '\\mathbb{N}', name: 'Natural numbers', meaning: 'The counting numbers 0, 1, 2, 3, …' },
      { tex: '\\mathbb{Z}', name: 'Integers', meaning: 'Whole numbers including negatives: …, −2, −1, 0, 1, 2, …' },
      { tex: '\\mathbb{R}', name: 'Real numbers', meaning: 'All numbers on the number line (fractions, decimals, π, …).' },
      { tex: '\\mathbb{C}', name: 'Complex numbers', meaning: 'Numbers of the form a + bi that include the imaginary unit i.' },
      { tex: '\\mathbb{R}^n', name: 'n-dimensional real space', meaning: 'All vectors of n real numbers — e.g. ℝ² is the plane, ℝ³ is 3D space.' },
    ],
  },
  {
    title: 'Logic & definitions',
    blurb: 'The shorthand that connects statements.',
    symbols: [
      { tex: '\\forall x', name: 'For all', meaning: 'Universal quantifier: the statement holds for every x.' },
      { tex: '\\exists x', name: 'There exists', meaning: 'Existential quantifier: there is at least one x for which it holds.' },
      { tex: 'a := b', name: 'Defined as', meaning: 'a is defined to be b (the colon is on the side being defined).' },
      { tex: 'a =: b', name: 'Defines', meaning: 'b is defined to be a (same idea, other direction).' },
      { tex: 'a \\propto b', name: 'Proportional to', meaning: 'a equals b times some constant: a = c·b.' },
      { tex: 'g \\circ f', name: 'Composition', meaning: '"g after f": first apply f, then apply g — g(f(x)).' },
      { tex: '\\implies', name: 'Implies', meaning: 'If the left side is true, the right side follows.' },
      { tex: '\\iff', name: 'If and only if', meaning: 'Both sides imply each other — they are equivalent.' },
    ],
  },
  {
    title: 'Sets',
    blurb: 'Collections of things.',
    symbols: [
      { tex: '\\mathcal{A},\\ \\mathcal{C}', name: 'Sets', meaning: 'Sets are written in calligraphic uppercase.' },
      { tex: 'a \\in \\mathcal{A}', name: 'Element of', meaning: 'a is a member of the set A.' },
      { tex: '\\emptyset', name: 'Empty set', meaning: 'The set with no elements.' },
      { tex: '\\mathcal{A} \\backslash \\mathcal{B}', name: 'Set difference', meaning: '"A without B": elements in A that are not in B.' },
    ],
  },
  {
    title: 'Linear algebra',
    blurb: 'Vectors, matrices and the operations on them.',
    symbols: [
      { tex: '\\boldsymbol{x}^\\top,\\ \\boldsymbol{A}^\\top', name: 'Transpose', meaning: 'Flip a vector/matrix over its diagonal (rows become columns).' },
      { tex: '\\boldsymbol{A}^{-1}', name: 'Inverse', meaning: 'The matrix that undoes A: A·A⁻¹ = I.' },
      { tex: '\\langle \\boldsymbol{x}, \\boldsymbol{y} \\rangle', name: 'Inner product', meaning: 'A generalized dot product measuring how much two vectors align.' },
      { tex: '\\boldsymbol{x}^\\top \\boldsymbol{y}', name: 'Dot product', meaning: 'Sum of element-wise products — the standard inner product.' },
      { tex: '\\boldsymbol{I}_m', name: 'Identity matrix', meaning: 'The m×m matrix with 1s on the diagonal, 0s elsewhere (the "1" of matrices).' },
      { tex: '\\boldsymbol{0}_{m,n}', name: 'Zero matrix', meaning: 'An m×n matrix of all zeros.' },
      { tex: '\\boldsymbol{1}_{m,n}', name: 'Ones matrix', meaning: 'An m×n matrix of all ones.' },
      { tex: '\\boldsymbol{e}_i', name: 'Standard basis vector', meaning: 'A vector with 1 in position i and 0 everywhere else.' },
      { tex: '\\dim', name: 'Dimension', meaning: 'The number of independent directions in a vector space.' },
      { tex: '\\operatorname{rk}(\\boldsymbol{A})', name: 'Rank', meaning: 'The number of linearly independent rows/columns of A.' },
      { tex: '\\operatorname{Im}(\\Phi)', name: 'Image', meaning: 'The set of all outputs of a linear map Φ.' },
      { tex: '\\ker(\\Phi)', name: 'Kernel (null space)', meaning: 'The set of inputs that a linear map Φ sends to zero.' },
      { tex: '\\operatorname{span}[\\boldsymbol{b}_1]', name: 'Span', meaning: 'All vectors reachable as combinations of the given vectors.' },
      { tex: '\\operatorname{tr}(\\boldsymbol{A})', name: 'Trace', meaning: 'The sum of the diagonal entries of a square matrix.' },
      { tex: '\\det(\\boldsymbol{A})', name: 'Determinant', meaning: 'A number telling how a matrix scales area/volume (0 = not invertible).' },
      { tex: '\\lvert \\cdot \\rvert', name: 'Absolute value / determinant', meaning: 'Absolute value of a number, or the determinant of a matrix (context tells which).' },
      { tex: '\\lVert \\cdot \\rVert', name: 'Norm', meaning: 'The length/magnitude of a vector (Euclidean unless stated otherwise).' },
      { tex: '\\boldsymbol{x} \\perp \\boldsymbol{y}', name: 'Orthogonal', meaning: 'The two vectors are perpendicular (their inner product is 0).' },
      { tex: 'V', name: 'Vector space', meaning: 'A set of vectors closed under addition and scaling.' },
      { tex: 'V^{\\perp}', name: 'Orthogonal complement', meaning: 'All vectors perpendicular to every vector in V.' },
      { tex: '\\lambda', name: 'Eigenvalue / multiplier', meaning: 'An eigenvalue of a matrix, or a Lagrange multiplier in optimization.' },
      { tex: 'E_{\\lambda}', name: 'Eigenspace', meaning: 'All eigenvectors sharing the eigenvalue λ (plus the zero vector).' },
    ],
  },
  {
    title: 'Calculus & optimization',
    blurb: 'Rates of change, sums, and finding the best value.',
    symbols: [
      { tex: '\\textstyle\\sum_{n=1}^{N} x_n', name: 'Summation', meaning: 'Add up the terms x₁ + x₂ + … + x_N.' },
      { tex: '\\textstyle\\prod_{n=1}^{N} x_n', name: 'Product', meaning: 'Multiply the terms x₁ · x₂ · … · x_N.' },
      { tex: '\\dfrac{\\partial f}{\\partial x}', name: 'Partial derivative', meaning: 'Rate of change of f in the x-direction, holding other variables fixed.' },
      { tex: '\\dfrac{\\mathrm{d}f}{\\mathrm{d}x}', name: 'Total derivative', meaning: 'Rate of change of f with respect to x, accounting for all dependencies.' },
      { tex: '\\nabla', name: 'Gradient (nabla)', meaning: 'The vector of all partial derivatives — points uphill (steepest ascent).' },
      { tex: 'f^{*} = \\min_x f(x)', name: 'Minimum value', meaning: 'The smallest value the function f attains.' },
      { tex: 'x^{*} \\in \\arg\\min_x f(x)', name: 'Argmin', meaning: 'The input x that achieves the minimum (arg min returns the location, not the value).' },
      { tex: '\\boldsymbol{\\theta}', name: 'Parameter vector', meaning: 'The collection of parameters a model learns.' },
      { tex: '\\mathfrak{L}', name: 'Lagrangian', meaning: 'The objective plus constraint terms used in constrained optimization.' },
      { tex: '\\mathcal{L}', name: 'Negative log-likelihood', meaning: 'A common loss: minimizing it maximizes how well the model explains the data.' },
    ],
  },
  {
    title: 'Probability & statistics',
    blurb: 'Reasoning about uncertainty and distributions.',
    symbols: [
      { tex: '\\binom{n}{k}', name: 'Binomial coefficient', meaning: '"n choose k": the number of ways to pick k items from n.' },
      { tex: '\\mathbb{E}_X[x]', name: 'Expectation', meaning: 'The average (mean) value of x under the random variable X.' },
      { tex: '\\mathbb{V}_X[x]', name: 'Variance', meaning: 'How spread out x is around its mean.' },
      { tex: '\\operatorname{Cov}_{X,Y}[x, y]', name: 'Covariance', meaning: 'How two quantities vary together (positive = move together).' },
      { tex: 'X \\sim p', name: 'Distributed as', meaning: 'The random variable X follows the distribution p.' },
      { tex: 'X \\perp\\!\\!\\!\\perp Y \\mid Z', name: 'Conditional independence', meaning: 'Given Z, knowing X tells you nothing extra about Y.' },
      { tex: '\\mathcal{N}(\\mu, \\Sigma)', name: 'Gaussian (normal)', meaning: 'The bell curve with mean μ and covariance Σ.' },
      { tex: '\\operatorname{Ber}(\\mu)', name: 'Bernoulli', meaning: 'A single yes/no trial with success probability μ.' },
      { tex: '\\operatorname{Bin}(N, \\mu)', name: 'Binomial', meaning: 'The count of successes in N independent Bernoulli trials.' },
      { tex: '\\operatorname{Beta}(\\alpha, \\beta)', name: 'Beta', meaning: 'A distribution over probabilities (values in [0, 1]).' },
    ],
  },
];

export interface Abbrev { short: string; full: string; }

export const ABBREVIATIONS: Abbrev[] = [
  { short: 'e.g.', full: 'exempli gratia (Latin: “for example”)' },
  { short: 'i.e.', full: 'id est (Latin: “that is / this means”)' },
  { short: 'i.i.d.', full: 'independent, identically distributed' },
  { short: 'GMM', full: 'Gaussian mixture model' },
  { short: 'MAP', full: 'maximum a posteriori' },
  { short: 'MLE', full: 'maximum likelihood estimation / estimator' },
  { short: 'ONB', full: 'orthonormal basis' },
  { short: 'PCA', full: 'principal component analysis' },
  { short: 'PPCA', full: 'probabilistic principal component analysis' },
  { short: 'REF', full: 'row-echelon form' },
  { short: 'SPD', full: 'symmetric, positive definite' },
  { short: 'SVM', full: 'support vector machine' },
];
