/* ============================================================
   Mapping between our lessons and "Mathematics for Machine Learning"
   (Deisenroth, Faisal & Ong, 2020). Single source of truth:
   - /book renders this whole table of contents with coverage.
   - LessonLayout uses bookRefForSlug() to show a "📖 In the book" badge.
   A section can be covered by several lessons (slugs[]), and a lesson
   can cover several sections.
   ============================================================ */

export const BOOK_META = {
  title: 'Mathematics for Machine Learning',
  authors: 'Deisenroth, Faisal & Ong',
  year: 2020,
  url: 'https://mml-book.com',
};

export interface BookSection {
  sec: string;        // e.g. "2.3" (or "2.0" for a chapter intro)
  title: string;
  slugs?: string[];   // lessons that cover this section
}
export interface BookChapter {
  n: number;
  part: 'I' | 'II';
  title: string;
  sections: BookSection[];
}

export const BOOK: BookChapter[] = [
  {
    n: 1, part: 'I', title: 'Introduction and Motivation',
    sections: [
      { sec: '1.1', title: 'Finding Words for Intuitions' },
      { sec: '1.2', title: 'Two Ways to Read This Book' },
      { sec: '1.3', title: 'Exercises and Feedback' },
    ],
  },
  {
    n: 2, part: 'I', title: 'Linear Algebra',
    sections: [
      { sec: '2.0', title: 'Vectors & notation (introduction)', slugs: ['linear-algebra/vectors'] },
      { sec: '2.1', title: 'Systems of Linear Equations', slugs: ['linear-algebra/gaussian-elimination'] },
      { sec: '2.2', title: 'Matrices', slugs: ['linear-algebra/matrices', 'linear-algebra/matrix-multiplication'] },
      { sec: '2.3', title: 'Solving Systems of Linear Equations', slugs: ['linear-algebra/gaussian-elimination'] },
      { sec: '2.4', title: 'Vector Spaces', slugs: ['linear-algebra/vector-spaces'] },
      { sec: '2.5', title: 'Linear Independence', slugs: ['linear-algebra/span'] },
      { sec: '2.6', title: 'Basis and Rank', slugs: ['linear-algebra/vector-spaces'] },
      { sec: '2.7', title: 'Linear Mappings', slugs: ['linear-algebra/linear-transformations'] },
      { sec: '2.8', title: 'Affine Spaces', slugs: ['linear-algebra/linear-transformations'] },
    ],
  },
  {
    n: 3, part: 'I', title: 'Analytic Geometry',
    sections: [
      { sec: '3.1', title: 'Norms', slugs: ['linear-algebra/vector-ops-dot'] },
      { sec: '3.2', title: 'Inner Products', slugs: ['linear-algebra/vector-ops-dot'] },
      { sec: '3.3', title: 'Lengths and Distances', slugs: ['linear-algebra/vector-ops-dot', 'geometry/coordinate-geometry'] },
      { sec: '3.4', title: 'Angles and Orthogonality', slugs: ['linear-algebra/orthogonality-projections'] },
      { sec: '3.5', title: 'Orthonormal Basis', slugs: ['linear-algebra/orthogonality-projections'] },
      { sec: '3.6', title: 'Orthogonal Complement', slugs: ['linear-algebra/orthogonality-projections'] },
      { sec: '3.7', title: 'Inner Product of Functions', slugs: ['linear-algebra/inner-product-functions'] },
      { sec: '3.8', title: 'Orthogonal Projections', slugs: ['linear-algebra/orthogonality-projections'] },
      { sec: '3.9', title: 'Rotations', slugs: ['geometry/transformations', 'linear-algebra/linear-transformations'] },
    ],
  },
  {
    n: 4, part: 'I', title: 'Matrix Decompositions',
    sections: [
      { sec: '4.1', title: 'Determinant and Trace', slugs: ['linear-algebra/inverse-determinant'] },
      { sec: '4.2', title: 'Eigenvalues and Eigenvectors', slugs: ['linear-algebra/eigenvectors'] },
      { sec: '4.3', title: 'Cholesky Decomposition', slugs: ['linear-algebra/decompositions'] },
      { sec: '4.4', title: 'Eigendecomposition and Diagonalization', slugs: ['linear-algebra/decompositions', 'linear-algebra/eigenvectors'] },
      { sec: '4.5', title: 'Singular Value Decomposition', slugs: ['linear-algebra/decompositions'] },
      { sec: '4.6', title: 'Matrix Approximation', slugs: ['linear-algebra/pca'] },
      { sec: '4.7', title: 'Matrix Phylogeny', slugs: ['linear-algebra/decompositions'] },
    ],
  },
  {
    n: 5, part: 'I', title: 'Vector Calculus',
    sections: [
      { sec: '5.1', title: 'Differentiation of Univariate Functions', slugs: ['calculus-1/derivative', 'calculus-1/differentiation-rules'] },
      { sec: '5.2', title: 'Partial Differentiation and Gradients', slugs: ['calculus-3/partial-derivatives', 'calculus-3/gradient'] },
      { sec: '5.3', title: 'Gradients of Vector-Valued Functions', slugs: ['calculus-3/chain-rule-jacobian'] },
      { sec: '5.4', title: 'Gradients of Matrices', slugs: ['calculus-3/vector-calculus-ml'] },
      { sec: '5.5', title: 'Useful Identities for Computing Gradients', slugs: ['calculus-3/vector-calculus-ml'] },
      { sec: '5.6', title: 'Backpropagation and Automatic Differentiation', slugs: ['calculus-3/vector-calculus-ml'] },
      { sec: '5.7', title: 'Higher-Order Derivatives', slugs: ['calculus-3/hessian'] },
      { sec: '5.8', title: 'Linearization and Multivariate Taylor Series', slugs: ['calculus-2/taylor-series'] },
    ],
  },
  {
    n: 6, part: 'I', title: 'Probability and Distributions',
    sections: [
      { sec: '6.1', title: 'Construction of a Probability Space', slugs: ['probability/sample-spaces'] },
      { sec: '6.2', title: 'Discrete and Continuous Probabilities', slugs: ['probability/random-variables', 'probability/discrete-distributions', 'probability/continuous-distributions'] },
      { sec: '6.3', title: 'Sum Rule, Product Rule, and Bayes’ Theorem', slugs: ['probability/conditional-bayes'] },
      { sec: '6.4', title: 'Summary Statistics and Independence', slugs: ['probability/expectation-variance', 'probability/joint-covariance', 'statistics/descriptive-stats'] },
      { sec: '6.5', title: 'Gaussian Distribution', slugs: ['probability/continuous-distributions'] },
      { sec: '6.6', title: 'Conjugacy and the Exponential Family', slugs: ['probability/conjugacy-exponential-family'] },
      { sec: '6.7', title: 'Change of Variables / Inverse Transform', slugs: ['probability/change-of-variables'] },
    ],
  },
  {
    n: 7, part: 'I', title: 'Continuous Optimization',
    sections: [
      { sec: '7.1', title: 'Optimization Using Gradient Descent', slugs: ['optimization/gradient-descent'] },
      { sec: '7.2', title: 'Constrained Optimization and Lagrange Multipliers', slugs: ['optimization/constrained-optimization'] },
      { sec: '7.3', title: 'Convex Optimization', slugs: ['optimization/convexity'] },
    ],
  },
  {
    n: 8, part: 'II', title: 'When Models Meet Data',
    sections: [
      { sec: '8.1', title: 'Data, Models, and Learning', slugs: ['ml-methods/when-models-meet-data'] },
      { sec: '8.2', title: 'Empirical Risk Minimization', slugs: ['ml-methods/when-models-meet-data'] },
      { sec: '8.3', title: 'Parameter Estimation', slugs: ['statistics/mle-map'] },
      { sec: '8.4', title: 'Probabilistic Modeling and Inference', slugs: ['ml-methods/when-models-meet-data'] },
      { sec: '8.5', title: 'Directed Graphical Models' },
      { sec: '8.6', title: 'Model Selection', slugs: ['ml-methods/when-models-meet-data'] },
    ],
  },
  {
    n: 9, part: 'II', title: 'Linear Regression',
    sections: [
      { sec: '9.1', title: 'Problem Formulation', slugs: ['statistics/regression'] },
      { sec: '9.2', title: 'Parameter Estimation', slugs: ['statistics/regression', 'optimization/ml-capstone'] },
      { sec: '9.3', title: 'Bayesian Linear Regression', slugs: ['probability/conjugacy-exponential-family'] },
      { sec: '9.4', title: 'Maximum Likelihood as Orthogonal Projection', slugs: ['linear-algebra/orthogonality-projections'] },
    ],
  },
  {
    n: 10, part: 'II', title: 'Dimensionality Reduction with PCA',
    sections: [
      { sec: '10.1', title: 'Problem Setting & Maximum Variance', slugs: ['linear-algebra/pca'] },
      { sec: '10.2', title: 'Projection Perspective', slugs: ['linear-algebra/pca'] },
      { sec: '10.3', title: 'Eigenvector Computation & Low-Rank Approximations', slugs: ['linear-algebra/pca', 'linear-algebra/decompositions'] },
      { sec: '10.4', title: 'PCA in Practice & Latent Variables', slugs: ['linear-algebra/pca'] },
    ],
  },
  {
    n: 11, part: 'II', title: 'Density Estimation with Gaussian Mixture Models',
    sections: [
      { sec: '11.1', title: 'Gaussian Mixture Model', slugs: ['ml-methods/gaussian-mixture-models'] },
      { sec: '11.2', title: 'Parameter Learning via Maximum Likelihood', slugs: ['ml-methods/gaussian-mixture-models'] },
      { sec: '11.3', title: 'EM Algorithm', slugs: ['ml-methods/gaussian-mixture-models'] },
    ],
  },
  {
    n: 12, part: 'II', title: 'Classification with Support Vector Machines',
    sections: [
      { sec: '12.1', title: 'Separating Hyperplanes', slugs: ['ml-methods/support-vector-machines'] },
      { sec: '12.2', title: 'Primal & Dual Support Vector Machine', slugs: ['ml-methods/support-vector-machines'] },
      { sec: '12.3', title: 'Kernels', slugs: ['ml-methods/support-vector-machines'] },
    ],
  },
];

// slug -> [{ ch, title, sec, secTitle }]
export interface SlugBookRef { ch: number; chapterTitle: string; sec: string; secTitle: string; }

export function bookRefsForSlug(slug: string): SlugBookRef[] {
  const out: SlugBookRef[] = [];
  for (const ch of BOOK) {
    for (const s of ch.sections) {
      if (s.slugs?.includes(slug)) {
        out.push({ ch: ch.n, chapterTitle: ch.title, sec: s.sec, secTitle: s.title });
      }
    }
  }
  return out;
}

/** Short badge label for a lesson, or null if it isn't in the book. */
export function bookBadge(slug: string): { short: string; full: string } | null {
  const refs = bookRefsForSlug(slug);
  if (refs.length === 0) return null;
  const first = refs[0];
  const secLabel = first.sec.endsWith('.0') ? `Ch ${first.ch}` : `§${first.sec}`;
  const more = refs.length > 1 ? ` (+${refs.length - 1} more)` : '';
  return {
    short: `${secLabel} · ${first.secTitle}${more}`,
    full: `${BOOK_META.title} — Ch ${first.ch} ${first.chapterTitle}`,
  };
}

// Coverage stats for the /book page.
export function coverageStats() {
  let total = 0, covered = 0;
  for (const ch of BOOK) for (const s of ch.sections) { total++; if (s.slugs?.length) covered++; }
  return { total, covered };
}
