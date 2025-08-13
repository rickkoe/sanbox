import React from "react";

const ImportOverlay = ({ parsing, importing }) => {
  if (!parsing && !importing) return null;

  return (
    <>
      <style>{`
        @keyframes importing-pulse {
          0%, 80%, 100% {
            transform: scale(0.5);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
      
      <div className="importing-overlay" style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        background: 'rgba(0, 0, 0, 0.8)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 9999 
      }}>
        <div className="importing-content" style={{
          textAlign: 'center',
          background: 'white',
          padding: '3rem 2rem',
          borderRadius: '15px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          maxWidth: '400px',
          width: '90%'
        }}>
          <div className="importing-spinner">
            <div className="spinner-border text-info" style={{ width: '4rem', height: '4rem' }} role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
          <h3 className={`mt-3 ${parsing ? 'text-info' : 'text-success'}`}>
            {parsing ? 'Processing Files...' : 'Importing Data...'}
          </h3>
          <p className="text-muted mb-0">
            {parsing ? 'Analyzing file contents and validating data...' : 'Creating aliases and zones in the database...'}
          </p>
          {importing && (
            <div className="mt-3">
              <div style={{
                display: 'inline-flex',
                gap: '0.5rem'
              }}>
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#198754',
                      borderRadius: '50%',
                      animation: `importing-pulse 1.4s ease-in-out infinite`,
                      animationDelay: `${i * 0.16}s`
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ImportOverlay;