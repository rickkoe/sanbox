import React, { useState, useContext } from 'react';
import { Dropdown } from 'react-bootstrap';
import { ChevronDown, GitCommit, ListChecks, Trash2 } from 'lucide-react';
import { ConfigContext } from '../../context/ConfigContext';
import { useProjectFilter } from '../../context/ProjectFilterContext';
import CommitProjectModal from '../modals/CommitProjectModal';
import DiscardChangesModal from '../modals/DiscardChangesModal';
import BulkEntitySelectorModal from '../modals/BulkEntitySelectorModal';

/**
 * ProjectOptionsDropdown Component
 *
 * Labeled dropdown menu for project-level actions.
 * Contains:
 * - Commit Changes: Opens the commit modal to push changes to Committed
 * - Bulk Add/Remove: Opens modal to bulk manage entity membership
 * - Discard Changes: Opens modal to discard uncommitted changes
 *
 * Disabled when:
 * - No active project selected, OR
 * - In Committed mode (projectFilter === 'all')
 */
const ProjectOptionsDropdown = () => {
    const { config } = useContext(ConfigContext);
    const { projectFilter } = useProjectFilter();

    const [showCommitModal, setShowCommitModal] = useState(false);
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);

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
            return 'Switch to Project View to access project options';
        }
        return 'Project actions';
    };

    return (
        <>
            <Dropdown className="project-actions-dropdown">
                <Dropdown.Toggle
                    variant="outline-secondary"
                    size="sm"
                    disabled={isDisabled}
                    title={getTooltip()}
                    className="project-actions-toggle"
                >
                    <span>Project Actions</span>
                    <ChevronDown size={14} />
                </Dropdown.Toggle>

                <Dropdown.Menu className="project-actions-menu">
                    <Dropdown.Item onClick={handleCommitClick}>
                        <GitCommit size={16} />
                        Commit Changes
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => setShowBulkModal(true)}>
                        <ListChecks size={16} />
                        Bulk Add/Remove
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item
                        onClick={() => setShowDiscardModal(true)}
                        className="text-danger"
                    >
                        <Trash2 size={16} />
                        Discard Changes
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

            {/* Discard Changes Modal */}
            <DiscardChangesModal
                show={showDiscardModal}
                onClose={() => setShowDiscardModal(false)}
                onSuccess={() => setShowDiscardModal(false)}
                projectId={activeProjectId}
                projectName={activeProjectName || 'Unknown Project'}
            />

            {/* Bulk Add/Remove Modal */}
            <BulkEntitySelectorModal
                show={showBulkModal}
                onClose={() => setShowBulkModal(false)}
            />
        </>
    );
};

export default ProjectOptionsDropdown;
