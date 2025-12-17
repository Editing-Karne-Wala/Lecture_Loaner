import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ThankYou from './components/ThankYou';
import ActiveSession from './components/ActiveSession';
import Reckoning from './components/Reckoning';
import Emergency from './components/Emergency';
import SessionComplete from './components/SessionComplete';

function App() {
    console.log("DEBUG: App component rendering...");
    const [currentView, setCurrentView] = useState('dashboard'); // dashboard, thankyou, activeSession, reckoning, emergency, sessionComplete
    const [emergencySuccess, setEmergencySuccess] = useState(false);
    const [graceUsed, setGraceUsed] = useState(false);
    const [isGracePeriod, setIsGracePeriod] = useState(false);
    const [targetTime, setTargetTime] = useState(null);

    const [reckoningCountdown, setReckoningCountdown] = useState(10);
    const [isReckoningActive, setIsReckoningActive] = useState(false);

    // SYNC STATE ON MOUNT (Run ONCE)
    useEffect(() => {
        const syncSession = async () => {
            try {
                const result = await window.electronAPI.checkSession();
                console.log("DEBUG: Initial session check:", result);
                // Only redirect if we are in dashboard (initial state)
                if (result.status === 'reckoning') {
                    setIsReckoningActive(true);
                    setCurrentView('reckoning');
                    if (result.targetTime) {
                        setTargetTime(new Date(result.targetTime));
                    }
                    if (result.gracePeriodUsed) {
                        setGraceUsed(true);
                    }
                } else if (result.status === 'activeSession') {
                    setTargetTime(new Date(result.targetTime));
                    setCurrentView('activeSession');
                    if (result.gracePeriodUsed) {
                        setGraceUsed(true);
                        setIsGracePeriod(true);
                    }
                }
            } catch (err) {
                console.error("Failed to check session:", err);
            }
        };
        syncSession();
    }, []); // Empty dependency array = Run once on mount

    // IPC LISTENERS
    useEffect(() => {
        const handleForceReckoning = () => {
            console.log("FORCE RECKONING RECEIVED");
            if (currentView !== 'reckoning' && currentView !== 'emergency' && currentView !== 'sessionComplete') {
                setIsReckoningActive(true);
                setCurrentView('reckoning');
            }
        };

        if (window.electronAPI && window.electronAPI.onForceReckoning) {
            window.electronAPI.onForceReckoning(handleForceReckoning);
        }

        return () => {
            if (window.electronAPI && window.electronAPI.removeForceReckoningListener) {
                window.electronAPI.removeForceReckoningListener(handleForceReckoning);
            }
        };
    }, [currentView]);

    // Persistent Countdown Logic
    const alarmTriggeredRef = React.useRef(false);

    useEffect(() => {
        if (!isReckoningActive) {
            alarmTriggeredRef.current = false;
        }
    }, [isReckoningActive]);

    useEffect(() => {
        let timer;
        if (isReckoningActive && reckoningCountdown > 0) {
            timer = setInterval(() => {
                setReckoningCountdown(prev => {
                    if (prev <= 1) {
                        if (!alarmTriggeredRef.current) {
                            window.electronAPI.startAlarm();
                            alarmTriggeredRef.current = true;
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (reckoningCountdown === 0 && isReckoningActive) {
            // Ensure alarm is playing if we hit 0
            if (!alarmTriggeredRef.current) {
                window.electronAPI.startAlarm();
                alarmTriggeredRef.current = true;
            }
        }
        return () => clearInterval(timer);
    }, [isReckoningActive, reckoningCountdown]);

    const renderView = () => {
        switch (currentView) {
            // ... (dashboard, thankyou cases unchanged)
            case 'dashboard':
                return <Dashboard onStartSession={(deadline) => {
                    console.log("Received deadline:", deadline);
                    setEmergencySuccess(false);
                    setGraceUsed(false);
                    setIsGracePeriod(false);
                    setReckoningCountdown(10); // Reset countdown
                    setIsReckoningActive(false);

                    let target = new Date(deadline);
                    if (isNaN(target.getTime())) {
                        console.warn("Invalid deadline received, defaulting to 30s test timer");
                        target = new Date(Date.now() + 30000);
                    }

                    setTargetTime(target);
                    setCurrentView('thankyou');
                }} />;
            case 'thankyou':
                return <ThankYou onDashboard={() => {
                    if (targetTime) {
                        setCurrentView('activeSession');
                    } else {
                        setCurrentView('dashboard');
                    }
                }} />;
            case 'activeSession':
                return <ActiveSession
                    onReckoning={() => {
                        setIsReckoningActive(true); // Start/Resume countdown
                        setCurrentView('reckoning');
                    }}
                    isGracePeriod={isGracePeriod}
                    targetTime={targetTime}
                    onInvalidState={() => setCurrentView('dashboard')}
                />;
            case 'reckoning':
                return <Reckoning
                    initialStatus={emergencySuccess ? 'ACCEPTED' : ''}
                    countdown={reckoningCountdown} // Pass lifted state
                    onEmergency={() => {
                        setIsReckoningActive(false); // Pause countdown
                        window.electronAPI.stopAlarm(); // Silence alarm
                        setCurrentView('emergency');
                    }}
                    onReset={() => {
                        setEmergencySuccess(false);
                        setGraceUsed(false);
                        setIsGracePeriod(false);
                        setTargetTime(null);
                        setIsReckoningActive(false); // Stop countdown
                        window.electronAPI.stopAlarm();
                        setCurrentView('dashboard');
                    }}
                    onBack={() => {
                        const now = new Date();
                        const isExpired = targetTime && now.getTime() >= targetTime.getTime();

                        console.log("DEBUG: onBack triggered.");
                        console.log("DEBUG: targetTime:", targetTime);
                        console.log("DEBUG: now:", now);
                        console.log("DEBUG: isExpired:", isExpired);

                        if (!isExpired) {
                            console.log("DEBUG: Session NOT expired. Stopping alarm and resetting countdown.");
                            // If not expired, reset the countdown logic
                            setIsReckoningActive(false);
                            setReckoningCountdown(10);
                            window.electronAPI.stopAlarm();
                        } else {
                            console.log("DEBUG: Session EXPIRED. Alarm should continue.");
                        }
                        // If expired, we DO NOT stop the countdown. It keeps running.

                        setCurrentView('activeSession');
                    }}
                    graceUsed={graceUsed}
                    onGrace={(duration) => {
                        setGraceUsed(true);
                        setIsGracePeriod(true);
                        setIsReckoningActive(false); // Pause/Stop countdown
                        setReckoningCountdown(10); // Reset countdown for the new grace period
                        window.electronAPI.stopAlarm();

                        // TELL BACKEND!
                        const minutes = duration / 60000;
                        window.electronAPI.requestGracePeriod(minutes).then(result => {
                            if (result.success && result.newDeadline) {
                                console.log("Frontend received new deadline:", result.newDeadline);
                                setTargetTime(new Date(result.newDeadline));
                            } else {
                                // Fallback if IPC fails (shouldn't happen)
                                console.warn("IPC grace period failed or no deadline returned. Using local calc.");
                                setTargetTime(new Date(new Date().getTime() + duration));
                            }
                        });

                        setCurrentView('activeSession');
                    }}
                    onComplete={() => {
                        setEmergencySuccess(false);
                        setTargetTime(null);
                        setIsReckoningActive(false); // Stop countdown
                        window.electronAPI.stopAlarm();
                        setCurrentView('sessionComplete');
                    }}
                />;
            case 'sessionComplete':
                return <SessionComplete onStartNew={() => setCurrentView('dashboard')} />;
            case 'emergency':
                return <Emergency onExit={() => {
                    setIsReckoningActive(true); // Resume countdown/alarm
                    setCurrentView('reckoning');
                }} onWin={() => {
                    setEmergencySuccess(true);
                    setIsReckoningActive(false); // Ensure it stays off
                    setCurrentView('reckoning');
                }} />;
            default:
                return <Dashboard onStartSession={() => {
                    setEmergencySuccess(false);
                    setCurrentView('thankyou');
                }} />;
        }
    };

    return (
        <div className="app-container">
            {renderView()}
        </div>
    );
}

export default App;
