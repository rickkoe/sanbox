import React, { useState, useContext } from 'react';
import { Dropdown } from 'react-bootstrap';
import { Settings, GitCommit } from 'lucide-react';
import { ConfigContext } from '../../context/ConfigContext';
import { useProjectFilter } from '../../context/ProjectFilterContext';
import CommitProjectModal from '../modals/CommitProjectModal';

/**
 * ProjectOptionsDropdown Component
 *
 * Dropdown menu for project-level actions.
 * Currently contains:
 * - Commit Project: Opens the commit modal to push changes to Live
 *
 * Disabled when:
 * - No active project selected, OR
 * - In Live mode (projectFilter === 'all')
 */
const ProjectOptionsDropdown = () => {
    const { config } = useContext(ConfigContext);
    const { projectFilter } = useProjectFilter();

    const [showCommitModal, setShowCommitModal] = useState(false);

    const activeProjectId = config?.active_project?.id;
    const activeProjectName = config?.active_project?.name;
    const hasProject = Boolean(activeProjectId);
    const isDraftMode = projectFilter === 'current';

    // Dropdown is disabled if no project or not in Draft mode
    const isDisabled = !hasProject || !isDraftMode;

    const handleCommitClick = () => {
        setShowCommitModal(true);
    };

    const handleCommitSuccess = () => {
        setShowCommitModal(false);
        // The modal handles switching to Live mode and refreshing data
    };

    const getTooltip = () => {
        if (!hasProject) {
            return 'Select a project to access options';
        }
        if (!isDraftMode) {
            return 'Switch to Draft mode to access project options';
        }
        return 'Project options';
    };

    return (
        <>
            <Dropdown>
                <Dropdown.Toggle
                    variant="outline-secondary"
                    size="sm"
                    disabled={isDisabled}
                    title={getTooltip()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'var(--dropdown-bg)',
                        color: isDisabled ? 'var(--color-fg-muted)' : 'var(--dropdown-text)',
                        border: '1px solid var(--border-color)',
                        opacity: isDisabled ? 0.5 : 1,
                        cursor: isDisabled ? 'not-allowed' : 'pointer'
                    }}
                >
                    <Settings size={16} />
                    Options
                </Dropdown.Toggle>

                <Dropdown.Menu
                    style={{
                        backgroundColor: 'var(--dropdown-bg)',
                        border: '1px solid var(--border-color)'
                    }}
                >
                    <Dropdown.Item
                        onClick={handleCommitClick}
                        style={{
                            color: 'var(--dropdown-text)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <GitCommit size={16} />
                        Commit Project
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>

            {/* Commit Project Modal */}
            <CommitProjectModal
                show={showCommitModal}
                onClose={() => setShowCommitModal(false)}
                onSuccess={handleCommitSuccess}
                projectId={activeProjectId}
                projectName={activeProjectName || 'Unknown Project'}
            />
        </>
    );
};

export default ProjectOptionsDropdown;
