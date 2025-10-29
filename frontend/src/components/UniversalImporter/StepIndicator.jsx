import React from 'react';
import { Check, Loader2 } from 'lucide-react';

const StepIndicator = ({ currentStep, importType, loading = false, importStatus = null }) => {
  // Step 2 changes based on import type
  const step2Label = importType === 'storage' ? 'Download Data' : 'Upload Data';

  const steps = [
    { id: 1, label: 'Select Type' },
    { id: 2, label: step2Label },
    { id: 3, label: 'Configure' },
    { id: 4, label: 'Execute' }
  ];

  // Check if step 4 is completed based on import status
  const isStep4Completed = importStatus === 'COMPLETED' || importStatus === 'SUCCESS';

  return (
    <div className="step-indicator-sticky">
      <div className="step-indicator-container">
        {/* Horizontal progress line */}
        <div className="step-indicator-line">
          {/* Completed portion of the line */}
          <div
            className={`step-indicator-line-progress ${loading ? 'loading' : ''}`}
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />

          {/* Loading animation overlay - shows on the next segment OR on step 4 */}
          {loading && (
            <div
              className="step-indicator-line-loading"
              style={{
                // For step 4, show on the last segment (step 3 to 4)
                // For other steps, show on the next segment
                left: currentStep === 4
                  ? `${((steps.length - 2) / (steps.length - 1)) * 100}%`
                  : `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
                width: `${(1 / (steps.length - 1)) * 100}%`
              }}
            />
          )}
        </div>

        {/* Step nodes */}
        <div className="step-indicator-steps">
          {steps.map((step, index) => {
            const isCompleted = step.id < currentStep || (step.id === 4 && isStep4Completed);
            const isActive = step.id === currentStep && !isStep4Completed;
            const isActiveAndLoading = isActive && loading;

            return (
              <div key={step.id} className="step-indicator-step">
                {/* Circle/Badge */}
                <div
                  className={`step-indicator-badge ${
                    isCompleted ? 'completed' : isActive ? 'active' : 'pending'
                  } ${isActiveAndLoading ? 'loading' : ''}`}
                >
                  {isCompleted ? (
                    <Check size={18} strokeWidth={3} />
                  ) : isActiveAndLoading ? (
                    <Loader2 size={18} strokeWidth={3} className="step-spinner" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>

                {/* Label */}
                <div className={`step-indicator-label ${isActiveAndLoading ? 'loading' : ''}`}>
                  {step.label}
                  {isActiveAndLoading && <span className="step-loading-dots">...</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile progress indicator */}
      <div className="step-indicator-mobile">
        <div className="step-indicator-mobile-text">
          Step {currentStep} of {steps.length}: {steps[currentStep - 1].label}
        </div>
        <div className="step-indicator-mobile-bar">
          <div
            className="step-indicator-mobile-bar-fill"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default StepIndicator;
