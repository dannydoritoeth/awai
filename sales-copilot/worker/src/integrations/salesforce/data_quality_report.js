const { DataQualityAnalyzer } = require('./data_quality_analyzer');

class DataQualityReportGenerator {
    constructor(client) {
        this.client = client;
        this.analyzer = new DataQualityAnalyzer();
    }

    async generateReport() {
        const report = {
            summary: {},
            entityAnalysis: {},
            aiReadiness: {},
            recommendations: [],
            timestamp: new Date().toISOString()
        };

        // Analyze each entity type
        const entityTypes = ['opportunity', 'lead', 'account', 'contact'];
        for (const type of entityTypes) {
            const records = await this._fetchRecords(type);
            const analysis = await this.analyzer.analyzeDataQuality(records, type);
            report.entityAnalysis[type] = analysis;
        }

        // Generate overall summary
        report.summary = this._generateSummary(report.entityAnalysis);
        
        // Compile AI readiness assessment
        report.aiReadiness = this._compileAiReadiness(report.entityAnalysis);
        
        // Compile and prioritize recommendations
        report.recommendations = this._compileRecommendations(report.entityAnalysis);

        return this._formatReport(report);
    }

    async _fetchRecords(type) {
        // Use existing client methods to fetch records
        switch (type) {
            case 'opportunity':
                return await this.client.getOpportunityHistory();
            case 'lead':
                return await this.client.getLeadScoreHistory();
            case 'account':
                return await this.client.getAccounts();
            case 'contact':
                return await this.client.getContacts();
            default:
                return [];
        }
    }

    _generateSummary(entityAnalysis) {
        const summary = {
            overallScore: 0,
            criticalIssuesCount: 0,
            dataQualityByEntity: {},
            topIssues: [],
            readinessAssessment: ''
        };

        // Calculate overall metrics
        let totalScore = 0;
        Object.entries(entityAnalysis).forEach(([entity, analysis]) => {
            totalScore += analysis.overallScore;
            summary.criticalIssuesCount += analysis.criticalIssues.length;
            summary.dataQualityByEntity[entity] = {
                score: analysis.overallScore,
                criticalIssues: analysis.criticalIssues.length,
                completeness: this._calculateEntityCompleteness(analysis)
            };
        });

        summary.overallScore = totalScore / Object.keys(entityAnalysis).length;

        // Identify top issues
        summary.topIssues = this._identifyTopIssues(entityAnalysis);

        // Generate readiness assessment
        summary.readinessAssessment = this._generateReadinessAssessment(summary);

        return summary;
    }

    _compileAiReadiness(entityAnalysis) {
        const aiReadiness = {
            overallScore: 0,
            readyCapabilities: [],
            limitedCapabilities: [],
            blockedCapabilities: [],
            improvementPath: []
        };

        // Compile capabilities from all entities
        Object.values(entityAnalysis).forEach(analysis => {
            const { score, enablers, limitations } = analysis.aiReadiness;
            
            // Aggregate scores
            aiReadiness.overallScore += score;
            
            // Compile capabilities
            enablers.forEach(enabler => {
                if (!aiReadiness.readyCapabilities.includes(enabler.capability)) {
                    aiReadiness.readyCapabilities.push(enabler.capability);
                }
            });
            
            limitations.forEach(limitation => {
                if (limitation.impact.includes('critical')) {
                    aiReadiness.blockedCapabilities.push(limitation.field);
                } else {
                    aiReadiness.limitedCapabilities.push(limitation.field);
                }
            });
        });

        // Normalize overall score
        aiReadiness.overallScore /= Object.keys(entityAnalysis).length;

        // Generate improvement path
        aiReadiness.improvementPath = this._generateImprovementPath(entityAnalysis);

        return aiReadiness;
    }

    _compileRecommendations(entityAnalysis) {
        const recommendations = [];
        const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };

        // Gather all recommendations
        Object.entries(entityAnalysis).forEach(([entity, analysis]) => {
            analysis.recommendations.forEach(rec => {
                recommendations.push({
                    ...rec,
                    entity,
                    impact: rec.aiImpact || 'General improvement'
                });
            });
        });

        // Sort by priority
        return recommendations.sort((a, b) => {
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            
            // If same priority, sort by impact
            return b.impact.localeCompare(a.impact);
        });
    }

    _formatReport(report) {
        return {
            title: 'Salesforce Data Quality Analysis for AI Readiness',
            generatedAt: report.timestamp,
            executiveSummary: {
                overallScore: `${(report.summary.overallScore * 100).toFixed(1)}%`,
                aiReadiness: `${(report.aiReadiness.overallScore * 100).toFixed(1)}%`,
                criticalIssues: report.summary.criticalIssuesCount,
                readinessAssessment: report.summary.readinessAssessment
            },
            dataQualityAnalysis: {
                byEntity: report.summary.dataQualityByEntity,
                criticalIssues: report.summary.topIssues
            },
            aiCapabilityAssessment: {
                readyToUse: report.aiReadiness.readyCapabilities,
                limited: report.aiReadiness.limitedCapabilities,
                blocked: report.aiReadiness.blockedCapabilities
            },
            actionPlan: {
                immediate: this._filterRecommendations(report.recommendations, 'High'),
                shortTerm: this._filterRecommendations(report.recommendations, 'Medium'),
                longTerm: this._filterRecommendations(report.recommendations, 'Low')
            },
            improvementRoadmap: report.aiReadiness.improvementPath,
            detailedAnalysis: report.entityAnalysis
        };
    }

    _calculateEntityCompleteness(analysis) {
        const fieldAnalysis = Object.values(analysis.fieldAnalysis);
        return fieldAnalysis.reduce((sum, field) => sum + field.completeness, 0) / fieldAnalysis.length;
    }

    _identifyTopIssues(entityAnalysis) {
        const allIssues = [];
        Object.entries(entityAnalysis).forEach(([entity, analysis]) => {
            analysis.criticalIssues.forEach(issue => {
                allIssues.push({
                    entity,
                    ...issue,
                    score: issue.completeness
                });
            });
        });

        return allIssues
            .sort((a, b) => a.score - b.score)
            .slice(0, 5);
    }

    _generateReadinessAssessment(summary) {
        if (summary.overallScore >= 0.9) {
            return 'Ready for AI implementation with high confidence';
        } else if (summary.overallScore >= 0.7) {
            return 'Ready for initial AI implementation with some limitations';
        } else if (summary.overallScore >= 0.5) {
            return 'Requires significant data quality improvements before AI implementation';
        } else {
            return 'Major data quality issues must be addressed before considering AI implementation';
        }
    }

    _generateImprovementPath(entityAnalysis) {
        const path = [];
        const phases = {
            1: { title: 'Critical Data Quality Fixes', items: [] },
            2: { title: 'Data Standardization', items: [] },
            3: { title: 'Process Improvements', items: [] }
        };

        Object.entries(entityAnalysis).forEach(([entity, analysis]) => {
            analysis.recommendations.forEach(rec => {
                if (rec.priority === 'High') {
                    phases[1].items.push({ entity, ...rec });
                } else if (rec.impact.includes('standardiz')) {
                    phases[2].items.push({ entity, ...rec });
                } else {
                    phases[3].items.push({ entity, ...rec });
                }
            });
        });

        return Object.values(phases);
    }

    _filterRecommendations(recommendations, priority) {
        return recommendations.filter(rec => rec.priority === priority);
    }
}

module.exports = {
    DataQualityReportGenerator
}; 