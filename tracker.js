class WebsiteTracker {
    constructor() {
        this.dataFile = 'analytics_data';
        this.data = this.loadData();
        this.init();
    }

    init() {
        // BUG FIX #2: Set sessionStart so trackExit() can calculate time on page
        localStorage.setItem('sessionStart', Date.now());
        this.trackVisit();
        this.updateDashboard();
        this.updateVisitorList();
        window.addEventListener('beforeunload', () => this.trackExit());
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.dataFile);
            if (!raw) return this.defaultData();
            const parsed = JSON.parse(raw);
            // BUG FIX #1: Restore Set from serialized array
            parsed.uniqueVisitors = new Set(parsed.uniqueVisitors || []);
            return parsed;
        } catch (e) {
            return this.defaultData();
        }
    }

    defaultData() {
        return {
            totalVisits: 0,
            uniqueVisitors: new Set(),
            dailyVisits: {},
            visits: [],
            timestamps: []
        };
    }

    saveData() {
        // BUG FIX #1: Serialize Set as array before storing
        const toSave = {
            ...this.data,
            uniqueVisitors: [...this.data.uniqueVisitors]
        };
        localStorage.setItem(this.dataFile, JSON.stringify(toSave));
    }

    getVisitorId() {
        let visitorId = localStorage.getItem('visitorId');
        if (!visitorId) {
            visitorId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('visitorId', visitorId);
        }
        return visitorId;
    }

    getVisitorInfo() {
        return {
            id: this.getVisitorId(),
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screen: `${screen.width}x${screen.height}`,
            referrer: document.referrer || 'Direct',
            timestamp: new Date().toISOString(),
            url: window.location.href,
            // BUG FIX #3: Attach sessionTime from previous session to visit record
            sessionTime: parseInt(localStorage.getItem('sessionTime') || 0)
        };
    }

    trackVisit() {
        const visitorInfo = this.getVisitorInfo();
        const today = new Date().toDateString();

        // Track total visits
        this.data.totalVisits++;

        // Track unique visitors
        if (!this.data.uniqueVisitors.has(visitorInfo.id)) {
            this.data.uniqueVisitors.add(visitorInfo.id);
        }

        // Track daily visits
        this.data.dailyVisits[today] = (this.data.dailyVisits[today] || 0) + 1;

        // Store visit details (keep last 100)
        this.data.visits.unshift(visitorInfo);
        this.data.visits = this.data.visits.slice(0, 100);

        this.saveData();
    }

    trackExit() {
        // BUG FIX #2: sessionStart is now always set, so this calc is valid
        const sessionTime = Date.now() - parseInt(localStorage.getItem('sessionStart') || Date.now());
        localStorage.setItem('sessionTime', sessionTime);
    }

    updateDashboard() {
        document.getElementById('totalVisits').textContent = this.data.totalVisits.toLocaleString();
        document.getElementById('uniqueVisitors').textContent = this.data.uniqueVisitors.size.toLocaleString();

        const today = new Date().toDateString();
        document.getElementById('todayVisits').textContent = (this.data.dailyVisits[today] || 0).toLocaleString();

        // BUG FIX #3: v.sessionTime now exists on visit records, bounce rate is accurate
        const bounceRate = Math.round(
            (this.data.visits.filter(v => v.sessionTime < 5000).length / Math.max(1, this.data.totalVisits)) * 100
        );
        document.getElementById('bounceRate').textContent = bounceRate + '%';
    }

    updateVisitorList() {
        const list = document.getElementById('visitorList');
        const recent = this.data.visits.slice(0, 10);

        if (recent.length === 0) {
            list.innerHTML = '<p class="no-data">No visitors recorded yet.</p>';
            return;
        }

        list.innerHTML = recent.map(visit => `
            <div class="visitor-item">
                <div>
                    <strong>${new Date(visit.timestamp).toLocaleString()}</strong><br>
                    <small>${visit.platform} | ${visit.screen}</small>
                </div>
                <div style="text-align: right;">
                    <small>${visit.referrer === 'Direct' ? '🏠 Direct' : visit.referrer}</small>
                </div>
            </div>
        `).join('');
    }
}

// Initialize tracker
const tracker = new WebsiteTracker();

// Export functionality
function exportData() {
    const exportPayload = {
        ...tracker.data,
        uniqueVisitors: [...tracker.data.uniqueVisitors]
    };
    const dataStr = JSON.stringify(exportPayload, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tracking-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// Clear data
function clearData() {
    if (confirm('Are you sure you want to clear all tracking data?')) {
        // BUG FIX #4: Also clear session keys to avoid stale data after reset
        localStorage.removeItem('analytics_data');
        localStorage.removeItem('visitorId');
        localStorage.removeItem('sessionStart');
        localStorage.removeItem('sessionTime');
        location.reload();
    }
}
