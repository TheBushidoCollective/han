/**
 * Project List Page
 *
 * Displays all projects with their worktrees and session counts.
 * Includes search filter and sorting options.
 * Uses Relay for data fetching with PageLoader for query preloading.
 *
 * Note: The projects field returns a simple array, not a connection type,
 * so pagination is handled client-side. If the project count grows large,
 * consider updating the backend to return a ProjectConnection type.
 */

import type React from "react";
import { graphql } from "react-relay";
import { PageLoader } from "@/components/helpers";
import type { ProjectListPageQuery as ProjectListPageQueryType } from "./__generated__/ProjectListPageQuery.graphql.ts";
import { ProjectsContent } from "./ProjectsContent.tsx";

/**
 * Top-level query for projects page
 */
export const ProjectListPageQuery = graphql`
  query ProjectListPageQuery {
    projects(first: 100) {
      id
      projectId
      repoId
      name
      totalSessions
      lastActivity
      worktrees {
        name
        path
        sessionCount
        isWorktree
        subdirs {
          relativePath
          path
          sessionCount
        }
      }
    }
  }
`;

/**
 * Project list page with PageLoader for query preloading
 */
export default function ProjectListPage(): React.ReactElement {
	return (
		<PageLoader<ProjectListPageQueryType>
			query={ProjectListPageQuery}
			loadingMessage="Loading projects..."
		>
			{(queryRef) => <ProjectsContent queryRef={queryRef} />}
		</PageLoader>
	);
}
