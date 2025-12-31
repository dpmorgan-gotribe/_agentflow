/**
 * Project Name Extractor
 *
 * Extracts or infers a project name from a user prompt.
 * Handles explicit naming (e.g., "call it photography-app") and
 * infers names from project descriptions.
 */

/**
 * Patterns to detect explicit project names in prompts
 */
const EXPLICIT_NAME_PATTERNS = [
  /call\s+it\s+["']?([a-zA-Z][a-zA-Z0-9-_]+)["']?/i,
  /named?\s+["']?([a-zA-Z][a-zA-Z0-9-_]+)["']?/i,
  /called?\s+["']?([a-zA-Z][a-zA-Z0-9-_]+)["']?/i,
  /project\s+name[:\s]+["']?([a-zA-Z][a-zA-Z0-9-_]+)["']?/i,
  /app\s+name[:\s]+["']?([a-zA-Z][a-zA-Z0-9-_]+)["']?/i,
];

/**
 * Common words to filter out when inferring project names
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'create', 'build', 'make', 'develop', 'implement', 'design', 'write',
  'want', 'like', 'please', 'help', 'me', 'i', 'my', 'we', 'our',
  'this', 'that', 'these', 'those', 'it', 'its', 'simple', 'basic',
  'new', 'just', 'only', 'also', 'very', 'really', 'actually',
]);

/**
 * Project type keywords that can be used in naming
 */
const PROJECT_TYPE_KEYWORDS = [
  'app', 'application', 'website', 'site', 'platform', 'portal',
  'dashboard', 'api', 'service', 'tool', 'system', 'manager',
  'tracker', 'viewer', 'editor', 'builder', 'generator',
];

/**
 * Extracts an explicit project name from the prompt if specified
 */
function extractExplicitName(prompt: string): string | null {
  for (const pattern of EXPLICIT_NAME_PATTERNS) {
    const match = prompt.match(pattern);
    if (match?.[1]) {
      return sanitizeName(match[1]);
    }
  }
  return null;
}

/**
 * Infers a project name from the prompt description
 */
function inferProjectName(prompt: string): string {
  // Tokenize and clean
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

  if (words.length === 0) {
    return 'untitled-project';
  }

  // Look for domain + type patterns (e.g., "photography app" -> "photography-app")
  const meaningfulWords: string[] = [];
  let hasProjectType = false;

  for (const word of words) {
    if (PROJECT_TYPE_KEYWORDS.includes(word)) {
      hasProjectType = true;
      if (meaningfulWords.length > 0) {
        meaningfulWords.push(word);
        break; // Stop after finding type
      }
    } else if (meaningfulWords.length < 3) {
      meaningfulWords.push(word);
    }
  }

  // If no project type found, add a default suffix
  if (!hasProjectType && meaningfulWords.length > 0) {
    meaningfulWords.push('app');
  }

  // Join with hyphens
  const name = meaningfulWords.slice(0, 3).join('-');
  return sanitizeName(name) || 'untitled-project';
}

/**
 * Sanitizes a name to be a valid directory/project name
 */
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Result of project name extraction
 */
export interface ProjectNameResult {
  name: string;
  isExplicit: boolean;
  slug: string;
}

/**
 * Extracts or infers a project name from a prompt
 *
 * @param prompt - The user's input prompt
 * @returns Project name result with name, whether it was explicit, and a slug
 *
 * @example
 * extractProjectName("Create a photography app, call it photo-gallery")
 * // { name: "photo-gallery", isExplicit: true, slug: "photo-gallery" }
 *
 * @example
 * extractProjectName("Build me an e-commerce website for selling books")
 * // { name: "e-commerce-website", isExplicit: false, slug: "e-commerce-website" }
 */
export function extractProjectName(prompt: string): ProjectNameResult {
  // Try explicit name first
  const explicitName = extractExplicitName(prompt);
  if (explicitName) {
    return {
      name: explicitName,
      isExplicit: true,
      slug: explicitName,
    };
  }

  // Infer from description
  const inferredName = inferProjectName(prompt);
  return {
    name: inferredName,
    isExplicit: false,
    slug: inferredName,
  };
}

/**
 * Generates a unique project slug by appending a counter if needed
 *
 * @param baseName - The base project name
 * @param existingNames - Set of existing project names to avoid collisions
 * @returns A unique project slug
 */
export function generateUniqueSlug(
  baseName: string,
  existingNames: Set<string>
): string {
  const slug = sanitizeName(baseName);

  if (!existingNames.has(slug)) {
    return slug;
  }

  // Append counter until unique
  let counter = 2;
  while (existingNames.has(`${slug}-${counter}`)) {
    counter++;
    if (counter > 1000) {
      // Safety limit
      return `${slug}-${Date.now()}`;
    }
  }

  return `${slug}-${counter}`;
}
