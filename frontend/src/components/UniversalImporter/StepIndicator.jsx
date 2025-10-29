import React from 'react';
import { Check } from 'lucide-react';

const StepIndicator = ({ currentStep, importType }) => {
  // Step 2 changes based on import type
  const step2Label = importType === 'storage' ? 'Download Data' : 'Upload Data';

  const steps = [
    { id: 1, label: 'Select Type' },
    { id: 2, label: step2Label },
    { id: 3, label: 'Configure' },
    { id: 4, label: 'Execute' }
  ];

  return (
    <div className="step-indicator-sticky">
      <div className="step-indicator-container">
        {/* Horizontal progress line */}
        <div className="step-indicator-line">
          {/* Completed portion of the line */}
          <div
            className="step-indicator-line-progress"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>

        {/* Step nodes */}
        <div className="step-indicator-steps">
          {steps.map((step, index) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;

            return (
              <div key={step.id} className="step-indicator-step">
                {/* Circle/Badge */}
                <div
                  className={`step-indicator-badge ${
                    isCompleted ? 'completed' : isActive ? 'active' : 'pending'
                  }`}
                >
                  {isCompleted ? (
                    <Check size={18} strokeWidth={3} />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>

                {/* Label */}
                <div className="step-indicator-label">
                  {step.label}
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
