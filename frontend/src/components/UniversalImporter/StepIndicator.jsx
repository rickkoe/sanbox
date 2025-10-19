import React from 'react';
import {
  Upload,
  FileSearch,
  Settings,
  CheckCircle,
  Database,
  Server,
  HardDrive
} from 'lucide-react';
import './styles/StepIndicator.css';

const StepIndicator = ({ currentStep, theme }) => {
  const steps = [
    {
      id: 1,
      label: 'Select Type',
      icon: Database,
      description: 'Choose data to import'
    },
    {
      id: 2,
      label: 'Upload Data',
      icon: Upload,
      description: 'Upload or paste your data'
    },
    {
      id: 3,
      label: 'Configure',
      icon: Settings,
      description: 'Review and configure import'
    },
    {
      id: 4,
      label: 'Execute',
      icon: CheckCircle,
      description: 'Import your data'
    }
  ];

  const getStepStatus = (stepId) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'active';
    return 'pending';
  };

  return (
    <div className={`step-indicator-container theme-${theme}`}>
      <div className="step-indicator">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;

          return (
            <React.Fragment key={step.id}>
              <div className={`step-item ${status}`}>
                <div className="step-connector-left" />
                <div className="step-connector-right" />

                <div className="step-icon-wrapper">
                  <div className="step-icon-bg" />
                  <div className="step-icon-ring" />
                  <div className="step-icon">
                    <Icon size={24} strokeWidth={2} />
                  </div>
                  {status === 'completed' && (
                    <div className="step-check">
                      <CheckCircle size={20} strokeWidth={2.5} />
                    </div>
                  )}
                </div>

                <div className="step-content">
                  <div className="step-label">{step.label}</div>
                  <div className="step-description">{step.description}</div>
                </div>

                {/* Progress line animation */}
                {index < steps.length - 1 && (
                  <div className="step-line">
                    <div
                      className={`step-line-fill ${
                        step.id < currentStep ? 'completed' : ''
                      }`}
                    />
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile progress bar */}
      <div className="mobile-progress">
        <div className="mobile-progress-bar">
          <div
            className="mobile-progress-fill"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
        <div className="mobile-progress-text">
          Step {currentStep} of {steps.length}: {steps[currentStep - 1]?.label}
        </div>
      </div>
    </div>
  );
};

export default StepIndicator;