/**
 * Han Memory Research Engine
 *
 * Implements "research until confident" - the core of team memory querying.
 *
 * Research flow:
 * 1. Start with question as initial lead
 * 2. Investigate each lead (search index, read content, follow references)
 * 3. Collect evidence and assess confidence
 * 4. Add new leads discovered during investigation
 * 5. Continue until confident OR leads exhausted
 *
 * Confidence levels:
 * - High: Multiple independent sources (different authors)
 * - Medium: Single strong source OR multiple sources from same author
 * - Low: No strong sources OR contradictory evidence
 */

import { learnFromResearch } from "./promotion.ts";
import type {
	Citation,
	Evidence,
	InvestigationResult,
	Lead,
	ResearchResult,
	SearchResult,
} from "./types.ts";

/**
 * Search function type - abstracts storage layer
 */
type SearchFn = (query: string) => Promise<SearchResult[]>;

/**
 * Confidence assessment based on collected evidence
 */
interface ConfidenceAssessment {
	confident: boolean;
	level: "high" | "medium" | "low";
	reason: string;
}

/**
 * Create a research engine with given storage backend
 */
export function createResearchEngine(searchFn: SearchFn) {
	return {
		async research(question: string): Promise<ResearchResult> {
			const leads: Lead[] = [
				{
					id: "initial",
					type: "initial",
					query: question,
					priority: 1,
				},
			];

			const explored = new Set<string>();
			const evidence: Evidence[] = [];
			const searchedSources: string[] = [];

			// Research until confident or leads exhausted
			while (leads.length > 0) {
				// Sort by priority and take highest priority lead
				leads.sort((a, b) => b.priority - a.priority);
				const lead = leads.shift();
				if (!lead) break;

				if (explored.has(lead.id)) {
					continue;
				}
				explored.add(lead.id);

				// Investigate this lead
				const findings = await investigateLead(lead, searchFn);
				evidence.push(...findings.evidence);

				// Track what we searched
				if (lead.type === "initial" && lead.query) {
					searchedSources.push(`query:${lead.query}`);
				} else if (lead.type === "commit" && lead.sha) {
					searchedSources.push(`git:commit:${lead.sha}`);
				} else if (lead.type === "pr" && lead.number) {
					searchedSources.push(`github:pr:${lead.number}`);
				}

				// Check if we can answer confidently
				const assessment = assessConfidence(question, evidence);

				if (assessment.confident || leads.length === 0) {
					// Auto-learn from research (self-learning)
					if (evidence.length > 0) {
						learnFromResearch(evidence);
					}
					// Either confident or exhausted leads
					return formatAnswer(question, evidence, assessment, searchedSources);
				}

				// Add new leads discovered (if not already explored)
				for (const newLead of findings.newLeads) {
					if (!explored.has(newLead.id)) {
						leads.push(newLead);
					}
				}
			}

			// Auto-learn even from low-confidence research
			if (evidence.length > 0) {
				learnFromResearch(evidence);
			}

			// Exhausted all leads without reaching confidence
			return {
				answer:
					"I researched thoroughly but couldn't find a definitive answer.",
				confidence: "low",
				citations: evidence.map((e) => e.citation),
				caveats: [`Searched: ${Array.from(explored).join(", ")}`],
				searched_sources: searchedSources,
			};
		},
	};
}

/**
 * Investigate a lead and return evidence + new leads
 */
async function investigateLead(
	lead: Lead,
	searchFn: SearchFn,
): Promise<InvestigationResult> {
	const evidence: Evidence[] = [];
	const newLeads: Lead[] = [];

	switch (lead.type) {
		case "initial": {
			// Level 1: Quick scan with keyword search
			if (!lead.query) break;

			const results = await searchFn(lead.query);

			for (const result of results.slice(0, 10)) {
				// Top 10 results
				const obs = result.observation;

				// Use PR context for excerpt if available
				let excerpt = result.excerpt;
				if (obs.pr_context?.description) {
					excerpt = obs.pr_context.description.slice(0, 200);
				}

				// Create citation
				const citation: Citation = {
					source: obs.source,
					excerpt,
					relevance: result.score,
					timestamp: obs.timestamp,
					author: obs.author,
				};

				// Extract claim from observation
				const claim = obs.summary;

				evidence.push({
					citation,
					claim,
					confidence: result.score,
				});

				// Check for references to follow
				const refs = extractReferences(obs.detail);
				for (const ref of refs) {
					newLeads.push(ref);
				}

				// If observation has PR context, explore it
				if (obs.pr_context) {
					newLeads.push({
						id: `pr-${obs.pr_context.number}`,
						type: "pr",
						number: obs.pr_context.number,
						priority: 0.8,
					});
				}
			}
			break;
		}

		case "commit": {
			// Level 2: Read actual commit content
			// For now, we rely on indexed observations
			// Future: could read git directly here
			if (!lead.sha) break;

			const results = await searchFn(lead.sha);
			for (const result of results) {
				const citation: Citation = {
					source: result.observation.source,
					excerpt: result.excerpt,
					relevance: result.score,
					timestamp: result.observation.timestamp,
					author: result.observation.author,
				};

				evidence.push({
					citation,
					claim: result.observation.summary,
					confidence: result.score,
				});
			}
			break;
		}

		case "pr": {
			// Level 2: Read PR description, reviews, linked issues
			if (!lead.number) break;

			const results = await searchFn(`pr:${lead.number}`);
			for (const result of results) {
				const citation: Citation = {
					source: result.observation.source,
					excerpt: result.excerpt,
					relevance: result.score,
					timestamp: result.observation.timestamp,
					author: result.observation.author,
				};

				evidence.push({
					citation,
					claim: result.observation.summary,
					confidence: result.score,
				});
			}
			break;
		}

		case "file": {
			// Level 2: Investigate file history
			if (!lead.path) break;

			const results = await searchFn(lead.path);
			for (const result of results) {
				if (result.observation.files.includes(lead.path)) {
					const citation: Citation = {
						source: result.observation.source,
						excerpt: result.excerpt,
						relevance: result.score,
						timestamp: result.observation.timestamp,
						author: result.observation.author,
					};

					evidence.push({
						citation,
						claim: result.observation.summary,
						confidence: result.score,
					});
				}
			}
			break;
		}

		case "reference": {
			// Level 3: Follow references (e.g., "See RFC-12")
			if (!lead.ref) break;

			const results = await searchFn(lead.ref);
			for (const result of results) {
				const citation: Citation = {
					source: result.observation.source,
					excerpt: result.excerpt,
					relevance: result.score,
					timestamp: result.observation.timestamp,
					author: result.observation.author,
				};

				evidence.push({
					citation,
					claim: result.observation.summary,
					confidence: result.score,
				});
			}
			break;
		}

		case "author": {
			// Investigate author's contributions
			if (!lead.author) break;

			const results = await searchFn(lead.author);
			for (const result of results) {
				if (result.observation.author === lead.author) {
					const citation: Citation = {
						source: result.observation.source,
						excerpt: result.excerpt,
						relevance: result.score,
						timestamp: result.observation.timestamp,
						author: result.observation.author,
					};

					evidence.push({
						citation,
						claim: result.observation.summary,
						confidence: result.score,
					});
				}
			}
			break;
		}
	}

	return { evidence, newLeads };
}

/**
 * Extract references from text (PR numbers, issue numbers, etc.)
 */
function extractReferences(text: string): Lead[] {
	const leads: Lead[] = [];

	// Match PR references: PR #123, PR#123, #123
	const prMatches = text.matchAll(/(?:PR\s*)?#(\d+)/gi);
	for (const match of prMatches) {
		const number = Number.parseInt(match[1], 10);
		leads.push({
			id: `pr-${number}`,
			type: "pr",
			number,
			priority: 0.7,
		});
	}

	// Match commit SHAs: git:commit:abc123, commit abc123
	const commitMatches = text.matchAll(
		/(?:git:commit:|commit\s+)([a-f0-9]{7,40})/gi,
	);
	for (const match of commitMatches) {
		const sha = match[1];
		leads.push({
			id: `commit-${sha}`,
			type: "commit",
			sha,
			priority: 0.6,
		});
	}

	// Match RFC/doc references: RFC-12, RFC 12
	const rfcMatches = text.matchAll(/RFC[- ](\d+)/gi);
	for (const match of rfcMatches) {
		const ref = `RFC-${match[1]}`;
		leads.push({
			id: `ref-${ref}`,
			type: "reference",
			ref,
			priority: 0.5,
		});
	}

	return leads;
}

/**
 * Assess confidence based on collected evidence
 */
function assessConfidence(
	_question: string,
	evidence: Evidence[],
): ConfidenceAssessment {
	if (evidence.length === 0) {
		return {
			confident: false,
			level: "low",
			reason: "No evidence found",
		};
	}

	// Group evidence by author
	const byAuthor = new Map<string, Evidence[]>();
	for (const ev of evidence) {
		const author = ev.citation.author || "unknown";
		if (!byAuthor.has(author)) {
			byAuthor.set(author, []);
		}
		byAuthor.get(author)?.push(ev);
	}

	// Count unique authors
	const uniqueAuthors = byAuthor.size;

	// Check for high-confidence evidence (score >= 0.5 - more lenient)
	const strongEvidence = evidence.filter((e) => e.confidence >= 0.5);

	// Multiple independent sources (different authors) → high confidence
	if (uniqueAuthors >= 2 && strongEvidence.length >= 2) {
		return {
			confident: true,
			level: "high",
			reason: `${uniqueAuthors} independent sources with strong evidence`,
		};
	}

	// Multiple contributions from same author with high scores → high confidence
	if (uniqueAuthors === 1 && strongEvidence.length >= 3) {
		return {
			confident: true,
			level: "high",
			reason: "Multiple strong contributions from same author",
		};
	}

	// Single strong source OR multiple from same author → medium confidence
	if (strongEvidence.length >= 1 || evidence.length >= 2) {
		return {
			confident: true,
			level: "medium",
			reason:
				evidence.length >= 2
					? "Multiple sources found"
					: "Single strong source found",
		};
	}

	// Weak evidence → low confidence
	return {
		confident: false,
		level: "low",
		reason: "Only weak evidence found",
	};
}

/**
 * Format final answer from collected evidence
 */
function formatAnswer(
	question: string,
	evidence: Evidence[],
	assessment: ConfidenceAssessment,
	searchedSources: string[],
): ResearchResult {
	const caveats: string[] = [];

	if (evidence.length === 0) {
		return {
			answer: "I researched thoroughly but couldn't find a definitive answer.",
			confidence: "low",
			citations: [],
			caveats: ["No relevant information found in indexed sources"],
			searched_sources: searchedSources,
		};
	}

	// Group evidence by author for expertise questions
	const byAuthor = new Map<string, Evidence[]>();
	for (const ev of evidence) {
		const author = ev.citation.author || "unknown";
		if (!byAuthor.has(author)) {
			byAuthor.set(author, []);
		}
		byAuthor.get(author)?.push(ev);
	}

	// Check for contradictions (conflicting claims about same thing)
	const contradictions = detectContradictions(evidence);
	if (contradictions.length > 0) {
		caveats.push(
			...contradictions.map(
				(c) => `Note: ${c.earlier} (changed to ${c.later})`,
			),
		);
	}

	// Build answer based on question type
	let answer = "";

	// Expertise questions: "who knows about X?", "who implemented X?", "who worked on X?"
	if (
		question.toLowerCase().includes("who knows") ||
		question.toLowerCase().includes("who worked on") ||
		question.toLowerCase().includes("who implemented") ||
		question.toLowerCase().includes("who created") ||
		question.toLowerCase().includes("who built") ||
		question.toLowerCase().includes("expert")
	) {
		// Sort authors by number of contributions
		const authorContributions = Array.from(byAuthor.entries())
			.map(([author, evidenceList]) => ({
				author,
				count: evidenceList.length,
				evidence: evidenceList,
			}))
			.sort((a, b) => b.count - a.count);

		const topAuthor = authorContributions[0];
		answer = `${topAuthor.author} has the most expertise on this topic with ${topAuthor.count} contribution${topAuthor.count > 1 ? "s" : ""}.`;

		if (topAuthor.evidence.length > 0) {
			answer += ` Key work includes: ${topAuthor.evidence
				.slice(0, 3)
				.map((e) => e.claim)
				.join("; ")}.`;
		}

		if (authorContributions.length > 1) {
			answer += ` Also contributed: ${authorContributions
				.slice(1, 3)
				.map((a) => a.author)
				.join(", ")}.`;
		}
	}
	// Temporal questions: "what did we do?"
	else if (
		question.toLowerCase().includes("what") ||
		question.toLowerCase().includes("how")
	) {
		// Sort evidence by timestamp (most recent first)
		const sortedEvidence = [...evidence].sort(
			(a, b) => (b.citation.timestamp || 0) - (a.citation.timestamp || 0),
		);

		// Use most recent evidence for the answer
		const latest = sortedEvidence[0];
		answer = latest.claim;

		if (latest.citation.excerpt) {
			answer += ` ${latest.citation.excerpt}`;
		}

		// Mention if approach has evolved
		if (sortedEvidence.length > 1) {
			const earliest = sortedEvidence[sortedEvidence.length - 1];
			const timeDiff =
				(latest.citation.timestamp || 0) - (earliest.citation.timestamp || 0);
			const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

			if (daysDiff > 30 && earliest.claim !== latest.claim) {
				caveats.push(
					`Approach has evolved over ${daysDiff} days from earlier implementation`,
				);
			}
		}
	}
	// Decision questions: "why did we choose X?"
	else if (
		question.toLowerCase().includes("why") ||
		question.toLowerCase().includes("decision")
	) {
		// Look for decision-type evidence
		const decisionEvidence = evidence.filter((e) =>
			e.claim.toLowerCase().includes("decided"),
		);

		if (decisionEvidence.length > 0) {
			answer = decisionEvidence
				.map((e) => `${e.claim}. ${e.citation.excerpt}`)
				.join(" ");
		} else {
			// Use highest confidence evidence
			const best = evidence.sort((a, b) => b.confidence - a.confidence)[0];
			answer = `${best.claim}. ${best.citation.excerpt}`;
		}
	}
	// General questions
	else {
		const best = evidence.sort((a, b) => b.confidence - a.confidence)[0];
		answer = best.claim;
		if (best.citation.excerpt) {
			answer += ` ${best.citation.excerpt}`;
		}
	}

	// Extract unique citations (deduplicate by source)
	const citationMap = new Map<string, Citation>();
	for (const ev of evidence) {
		if (!citationMap.has(ev.citation.source)) {
			citationMap.set(ev.citation.source, ev.citation);
		}
	}

	return {
		answer,
		confidence: assessment.level,
		citations: Array.from(citationMap.values()).sort(
			(a, b) => b.relevance - a.relevance,
		),
		caveats,
		searched_sources: searchedSources,
	};
}

/**
 * Detect contradictions in evidence (conflicting claims)
 */
function detectContradictions(
	evidence: Evidence[],
): Array<{ earlier: string; later: string }> {
	const contradictions: Array<{ earlier: string; later: string }> = [];

	// Sort by timestamp
	const sorted = [...evidence]
		.filter((e) => e.citation.timestamp)
		.sort((a, b) => (a.citation.timestamp || 0) - (b.citation.timestamp || 0));

	// Look for technology/tool changes
	const techKeywords = [
		"mongodb",
		"postgres",
		"mysql",
		"redis",
		"graphql",
		"rest",
		"react",
		"vue",
		"angular",
	];

	for (const keyword of techKeywords) {
		const mentions = sorted.filter(
			(e) =>
				e.claim.toLowerCase().includes(keyword) ||
				e.citation.excerpt.toLowerCase().includes(keyword),
		);

		if (mentions.length > 1) {
			const first = mentions[0];
			const last = mentions[mentions.length - 1];

			// Check if claims are different
			if (first.claim !== last.claim) {
				contradictions.push({
					earlier: first.claim,
					later: last.claim,
				});
			}
		}
	}

	return contradictions;
}
