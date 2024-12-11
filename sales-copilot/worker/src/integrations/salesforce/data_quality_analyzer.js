const { BaseMetadataProcessor } = require('../baseMetadataProcessor');

class DataQualityAnalyzer {
    constructor() {
        this.criticalFields = {
            opportunity: [
                { field: 'StageName', impact: 'critical', reason: 'Required for deal progression analysis' },
                { field: 'Amount', impact: 'critical', reason: 'Essential for revenue prediction' },
                { field: 'CloseDate', impact: 'critical', reason: 'Required for sales cycle analysis' },
                { field: 'Probability', impact: 'high', reason: 'Important for win prediction' },
                { field: 'Type', impact: 'medium', reason: 'Helps segment deal patterns' },
                { field: 'NextStep', impact: 'medium', reason: 'Indicates deal momentum' }
            ],
            lead: [
                { field: 'Industry', impact: 'critical', reason: 'Core to lead scoring' },
                { field: 'Company', impact: 'critical', reason: 'Required for firmographic analysis' },
                { field: 'Title', impact: 'high', reason: 'Important for lead qualification' },
                { field: 'Email', impact: 'high', reason: 'Required for engagement tracking' },
                { field: 'Phone', impact: 'medium', reason: 'Supports contact completeness' },
                { field: 'NumberOfEmployees', impact: 'high', reason: 'Key firmographic indicator' }
            ],
            account: [
                { field: 'Industry', impact: 'critical', reason: 'Core to account scoring' },
                { field: 'AnnualRevenue', impact: 'high', reason: 'Key for account potential' },
                { field: 'NumberOfEmployees', impact: 'high', reason: 'Important for sizing' },
                { field: 'Type', impact: 'medium', reason: 'Helps segment accounts' },
                { field: 'BillingCountry', impact: 'medium', reason: 'Geographic analysis' }
            ],
            contact: [
                { field: 'Title', impact: 'critical', reason: 'Required for stakeholder analysis' },
                { field: 'Email', impact: 'critical', reason: 'Required for engagement tracking' },
                { field: 'Phone', impact: 'medium', reason: 'Contact accessibility' },
                { field: 'Department', impact: 'high', reason: 'Important for role analysis' }
            ]
        };

        this.dataQualityThresholds = {
            critical: 0.95, // 95% completeness required
            high: 0.85,     // 85% completeness required
            medium: 0.70    // 70% completeness required
        };
    }

    async analyzeDataQuality(records, type) {
        const analysis = {
            totalRecords: records.length,
            fieldAnalysis: {},
            overallScore: 0,
            criticalIssues: [],
            recommendations: [],
            aiReadiness: {
                score: 0,
                limitations: [],
                enablers: []
            }
        };

        // Analyze each critical field
        this.criticalFields[type].forEach(fieldConfig => {
            const fieldAnalysis = this._analyzeField(records, fieldConfig);
            analysis.fieldAnalysis[fieldConfig.field] = fieldAnalysis;

            // Check against thresholds
            const threshold = this.dataQualityThresholds[fieldConfig.impact];
            if (fieldAnalysis.completeness < threshold) {
                analysis.criticalIssues.push({
                    field: fieldConfig.field,
                    impact: fieldConfig.impact,
                    completeness: fieldAnalysis.completeness,
                    threshold: threshold,
                    gap: threshold - fieldAnalysis.completeness,
                    reason: fieldConfig.reason
                });
            }
        });

        // Calculate overall score
        analysis.overallScore = this._calculateOverallScore(analysis.fieldAnalysis);

        // Generate AI readiness assessment
        analysis.aiReadiness = this._assessAiReadiness(analysis);

        // Generate recommendations
        analysis.recommendations = this._generateRecommendations(analysis);

        return analysis;
    }

    _analyzeField(records, fieldConfig) {
        const analysis = {
            totalCount: records.length,
            populatedCount: 0,
            validCount: 0,
            standardizedCount: 0,
            completeness: 0,
            quality: 0,
            commonIssues: {},
            patterns: {}
        };

        records.forEach(record => {
            const value = record[fieldConfig.field];
            
            // Check population
            if (value !== null && value !== undefined && value !== '') {
                analysis.populatedCount++;
                
                // Track patterns
                if (!analysis.patterns[value]) {
                    analysis.patterns[value] = 0;
                }
                analysis.patterns[value]++;

                // Check validity
                if (this._isValidValue(value, fieldConfig)) {
                    analysis.validCount++;
                }

                // Check standardization
                if (this._isStandardized(value, fieldConfig)) {
                    analysis.standardizedCount++;
                } else {
                    // Track standardization issues
                    const issue = this._getStandardizationIssue(value, fieldConfig);
                    if (issue) {
                        if (!analysis.commonIssues[issue]) {
                            analysis.commonIssues[issue] = 0;
                        }
                        analysis.commonIssues[issue]++;
                    }
                }
            }
        });

        // Calculate metrics
        analysis.completeness = analysis.populatedCount / analysis.totalCount;
        analysis.quality = (analysis.validCount + analysis.standardizedCount) / (2 * analysis.totalCount);

        return analysis;
    }

    _isValidValue(value, fieldConfig) {
        switch (fieldConfig.field) {
            case 'Email':
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            case 'Phone':
                return /^\+?[\d\s-()]+$/.test(value);
            case 'Amount':
            case 'AnnualRevenue':
                return !isNaN(value) && value >= 0;
            case 'NumberOfEmployees':
                return !isNaN(value) && value > 0;
            case 'Probability':
                return !isNaN(value) && value >= 0 && value <= 100;
            default:
                return true;
        }
    }

    _isStandardized(value, fieldConfig) {
        switch (fieldConfig.field) {
            case 'Industry':
                return this._isStandardIndustry(value);
            case 'Title':
                return this._isStandardTitle(value);
            case 'Type':
                return this._isStandardType(value);
            default:
                return true;
        }
    }

    _getStandardizationIssue(value, fieldConfig) {
        switch (fieldConfig.field) {
            case 'Industry':
                return !this._isStandardIndustry(value) ? 'Non-standard industry name' : null;
            case 'Title':
                return !this._isStandardTitle(value) ? 'Non-standard job title' : null;
            case 'Type':
                return !this._isStandardType(value) ? 'Non-standard type value' : null;
            default:
                return null;
        }
    }

    _calculateOverallScore(fieldAnalysis) {
        const weights = { critical: 0.5, high: 0.3, medium: 0.2 };
        let weightedSum = 0;
        let totalWeight = 0;

        Object.entries(fieldAnalysis).forEach(([field, analysis]) => {
            const fieldConfig = this._getFieldConfig(field);
            const weight = weights[fieldConfig.impact];
            weightedSum += analysis.quality * weight;
            totalWeight += weight;
        });

        return weightedSum / totalWeight;
    }

    _assessAiReadiness(analysis) {
        const assessment = {
            score: 0,
            limitations: [],
            enablers: [],
            impactedCapabilities: []
        };

        // Assess critical issues impact
        analysis.criticalIssues.forEach(issue => {
            if (issue.impact === 'critical') {
                assessment.limitations.push({
                    field: issue.field,
                    impact: `${(issue.gap * 100).toFixed(1)}% below required threshold`,
                    recommendation: this._getImprovementRecommendation(issue)
                });

                assessment.impactedCapabilities.push(
                    this._getImpactedAiCapability(issue.field)
                );
            }
        });

        // Calculate AI readiness score
        assessment.score = analysis.overallScore * (1 - (assessment.limitations.length * 0.1));

        // Identify enablers
        Object.entries(analysis.fieldAnalysis).forEach(([field, fieldAnalysis]) => {
            if (fieldAnalysis.completeness >= 0.9 && fieldAnalysis.quality >= 0.9) {
                assessment.enablers.push({
                    field,
                    strength: 'High quality and completeness',
                    capability: this._getEnabledAiCapability(field)
                });
            }
        });

        return assessment;
    }

    _generateRecommendations(analysis) {
        const recommendations = [];

        // Critical issues recommendations
        analysis.criticalIssues.forEach(issue => {
            recommendations.push({
                priority: 'High',
                field: issue.field,
                impact: issue.impact,
                action: this._getImprovementRecommendation(issue),
                aiImpact: this._getImpactedAiCapability(issue.field)
            });
        });

        // Data standardization recommendations
        Object.entries(analysis.fieldAnalysis).forEach(([field, fieldAnalysis]) => {
            if (Object.keys(fieldAnalysis.commonIssues).length > 0) {
                recommendations.push({
                    priority: 'Medium',
                    field: field,
                    action: `Standardize ${field} values using predefined picklists`,
                    examples: Object.keys(fieldAnalysis.commonIssues).slice(0, 3)
                });
            }
        });

        // Data collection process recommendations
        if (analysis.overallScore < 0.8) {
            recommendations.push({
                priority: 'High',
                action: 'Implement data validation rules in Salesforce',
                impact: 'Ensures data quality at entry point'
            });
            recommendations.push({
                priority: 'Medium',
                action: 'Provide data entry training to sales team',
                impact: 'Improves data quality understanding'
            });
        }

        return recommendations;
    }

    _getFieldConfig(field) {
        for (const type in this.criticalFields) {
            const config = this.criticalFields[type].find(f => f.field === field);
            if (config) return config;
        }
        return { impact: 'medium' };
    }

    _getImprovementRecommendation(issue) {
        const recommendations = {
            Industry: 'Implement standard industry picklist and data cleanup project',
            Title: 'Standardize job titles using role hierarchy',
            Amount: 'Make amount field mandatory and implement validation rules',
            Email: 'Implement email validation and verification process',
            Phone: 'Standardize phone number format and implement validation',
            Type: 'Use standard type picklist values'
        };
        return recommendations[issue.field] || `Improve ${issue.field} data quality`;
    }

    _getImpactedAiCapability(field) {
        const impacts = {
            Industry: 'Industry-based lead scoring and account segmentation',
            Title: 'Stakeholder analysis and buying center identification',
            Amount: 'Revenue forecasting and deal size prediction',
            Email: 'Engagement tracking and communication analysis',
            Phone: 'Contact accessibility scoring',
            Type: 'Deal pattern recognition and segmentation'
        };
        return impacts[field] || 'General AI capabilities';
    }

    _getEnabledAiCapability(field) {
        const capabilities = {
            Industry: 'Accurate industry-specific insights and scoring',
            Title: 'Precise stakeholder mapping and influence analysis',
            Amount: 'Reliable revenue predictions and forecasting',
            Email: 'Comprehensive engagement analysis',
            Phone: 'Complete communication pattern analysis',
            Type: 'Detailed segmentation and pattern recognition'
        };
        return capabilities[field] || 'Enhanced AI analysis';
    }
}

module.exports = {
    DataQualityAnalyzer
}; 