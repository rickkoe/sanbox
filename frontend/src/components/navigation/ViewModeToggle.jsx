import React, { useContext } from 'react';
import { ConfigContext } from '../../context/ConfigContext';
import { useProjectFilter } from '../../context/ProjectFilterContext';
import '../../styles/view-mode-toggle.css';

/**
 * ViewModeToggle Component
 *
 * A sliding toggle switch for switching between Committed and Project modes.
 * - Committed mode: Read-only view of committed data
 * - Project mode: Editable view for project work-in-progress
 *
 * Project mode is disabled when no project is selected.
 */
const ViewModeToggle = () => {
    const { config } = useContext(ConfigContext);
    const { projectFilter, setProjectFilter } = useProjectFilter();

    const activeProjectId = config?.active_project?.id;
    const hasProject = Boolean(activeProjectId);
    const isDraftMode = projectFilter === 'current';

    const handleToggle = () => {
        if (!hasProject) return; // Can't switch to Project mode without a project

        if (isDraftMode) {
            setProjectFilter('all');
        } else {
            setProjectFilter('current');
        }
    };

    const handleLiveClick = () => {
        if (!isDraftMode) return; // Already in Committed mode
        setProjectFilter('all');
    };

    const handleProjectClick = () => {
        if (!hasProject) return; // Can't switch to Project mode without a project
        if (isDraftMode) return; // Already in Project mode
        setProjectFilter('current');
    };

    return (
        <div className="view-mode-toggle-container">
            <span
                className={`view-mode-label ${!isDraftMode ? 'active' : ''}`}
                onClick={handleLiveClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleLiveClick()}
            >
                Committed
            </span>

            <button
                type="button"
                className={`view-mode-toggle ${isDraftMode ? 'draft' : 'live'} ${!hasProject ? 'disabled' : ''}`}
                onClick={handleToggle}
                disabled={!hasProject && !isDraftMode}
                title={!hasProject ? 'Select a project to enable Project mode' : (isDraftMode ? 'Switch to Committed mode' : 'Switch to Project mode')}
                aria-label={isDraftMode ? 'Switch to Committed mode' : 'Switch to Project mode'}
            >
                <span className="toggle-slider" />
            </button>

            <span
                className={`view-mode-label ${isDraftMode ? 'active' : ''} ${!hasProject ? 'disabled' : ''}`}
                onClick={handleProjectClick}
                role="button"
                tabIndex={hasProject ? 0 : -1}
                onKeyDown={(e) => e.key === 'Enter' && handleProjectClick()}
                title={!hasProject ? 'Select a project to enable Project mode' : undefined}
            >
                Project
            </span>
        </div>
    );
};

export default ViewModeToggle;
