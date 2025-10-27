import React from 'react';
import {
  Upload,
  Download,
  Settings,
  CheckCircle,
  Database
} from 'lucide-react';

const StepIndicator = ({ currentStep, importType }) => {
  // Step 2 changes based on import type
  const step2Config = importType === 'storage'
    ? {
        label: 'Download Data',
        description: 'Fetch data from Storage Insights',
        icon: Download
      }
    : {
        label: 'Upload Data',
        description: 'Upload or paste your data',
        icon: Upload
      };

  const steps = [
    {
      id: 1,
      label: 'Select Type',
      description: 'Choose data to import',
      icon: Database
    },
    {
      id: 2,
      ...step2Config
    },
    {
      id: 3,
      label: 'Configure',
      description: 'Review and configure import',
      icon: Settings
    },
    {
      id: 4,
      label: 'Execute',
      description: 'Import your data',
      icon: CheckCircle
    }
  ];

  const getStepStatus = (stepId) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'active';
    return 'pending';
  };

  return (
    <>
      {/* Desktop Step Indicator */}
      <div className="step-indicator-container">
        <div className="step-indicator">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id);
            const Icon = step.icon;

            return (
              <div key={step.id} className={`step-item ${status}`}>
                <div className="step-icon-wrapper">
                  <Icon size={24} strokeWidth={2} />
                </div>

                <div className="step-content-text">
                  <div className="step-label">{step.label}</div>
                  <div className="step-description">{step.description}</div>
                </div>

                {index < steps.length - 1 && (
                  <div className="step-connector" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Progress Bar */}
      <div className="mobile-progress">
        <div className="mobile-progress-label">
          Step {currentStep} of {steps.length}: {steps[currentStep - 1]?.label}
        </div>
        <div className="mobile-progress-bar">
          <div
            className="mobile-progress-fill"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
};

export default StepIndicator;
