import React, { useContext } from 'react';
import { ConfigContext } from '../../context/ConfigContext';
import { useProjectFilter } from '../../context/ProjectFilterContext';
import '../../styles/view-mode-toggle.css';

/**
 * ViewModeToggle Component
 *
 * A sliding toggle switch for switching between Committed and Draft modes.
 * - Committed mode: Read-only view of committed data
 * - Draft mode: Editable view for project work-in-progress
 *
 * Draft mode is disabled when no project is selected.
 */
const ViewModeToggle = () => {
    const { config } = useContext(ConfigContext);
    const { projectFilter, setProjectFilter } = useProjectFilter();

    const activeProjectId = config?.active_project?.id;
    const hasProject = Boolean(activeProjectId);
    const isDraftMode = projectFilter === 'current';

    const handleToggle = () => {
        if (!hasProject) return; // Can't switch to draft without a project

        if (isDraftMode) {
            setProjectFilter('all');
        } else {
            setProjectFilter('current');
        }
    };

    const handleLiveClick = () => {
        if (!isDraftMode) return; // Already in Live mode
        setProjectFilter('all');
    };

    const handleDraftClick = () => {
        if (!hasProject) return; // Can't switch to draft without a project
        if (isDraftMode) return; // Already in Draft mode
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
                title={!hasProject ? 'Select a project to enable Draft mode' : (isDraftMode ? 'Switch to Committed mode' : 'Switch to Draft mode')}
                aria-label={isDraftMode ? 'Switch to Committed mode' : 'Switch to Draft mode'}
            >
                <span className="toggle-slider" />
            </button>

            <span
                className={`view-mode-label ${isDraftMode ? 'active' : ''} ${!hasProject ? 'disabled' : ''}`}
                onClick={handleDraftClick}
                role="button"
                tabIndex={hasProject ? 0 : -1}
                onKeyDown={(e) => e.key === 'Enter' && handleDraftClick()}
                title={!hasProject ? 'Select a project to enable Draft mode' : undefined}
            >
                Draft
            </span>
        </div>
    );
};

export default ViewModeToggle;
