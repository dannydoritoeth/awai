class BaseDataQualityAnalyzer {
    constructor() {
        if (this.constructor === BaseDataQualityAnalyzer) {
            throw new Error("Abstract class 'BaseDataQualityAnalyzer' cannot be instantiated.");
        }
    }

    async analyzeQuality(entityType, data) {
        const report = await this.getBasicQualityReport(entityType, data);
        const duplicates = await this.findPotentialDuplicates(entityType, data);

        if (duplicates.length > 0) {
            report.issues.push({
                field: 'duplicate_check',
                severity: 'high',
                message: 'Potential duplicate records found',
                duplicates: duplicates
            });
            report.qualityScore -= Math.min(30, duplicates.length * 10);
        }

        return {
            ...report,
            qualityScore: Math.max(0, report.qualityScore)
        };
    }

    async getBasicQualityReport(entityType, data) {
        switch(entityType) {
            case 'contact':
                return this.analyzeContactQuality(data);
            case 'prospective_buyer':
                return this.analyzeProspectiveBuyerQuality(data);
            case 'enquiry':
                return this.analyzeEnquiryQuality(data);
            default:
                throw new Error(`Unsupported entity type: ${entityType}`);
        }
    }

    // Abstract methods that must be implemented by subclasses
    async findPotentialDuplicates(entityType, data) {
        throw new Error('findPotentialDuplicates must be implemented by subclass');
    }

    async analyzeContactQuality(contact) {
        throw new Error('analyzeContactQuality must be implemented by subclass');
    }

    async analyzeProspectiveBuyerQuality(buyer) {
        throw new Error('analyzeProspectiveBuyerQuality must be implemented by subclass');
    }

    async analyzeEnquiryQuality(enquiry) {
        throw new Error('analyzeEnquiryQuality must be implemented by subclass');
    }

    // Utility methods that can be used by all analyzers
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        // Basic Australian mobile format check
        const phoneRegex = /^(?:\+61|0)[4-5]\d{8}$/;
        return phoneRegex.test(phone.replace(/\s+/g, ''));
    }

    deduplicateResults(duplicates) {
        const uniqueDuplicates = {};
        
        for (const duplicate of duplicates) {
            const existingDuplicate = uniqueDuplicates[duplicate.id];
            
            if (!existingDuplicate || 
                this.getConfidenceScore(duplicate.confidence) > 
                this.getConfidenceScore(existingDuplicate.confidence)) {
                uniqueDuplicates[duplicate.id] = duplicate;
            }
        }

        return Object.values(uniqueDuplicates);
    }

    getConfidenceScore(confidence) {
        const scores = {
            'high': 3,
            'medium': 2,
            'low': 1
        };
        return scores[confidence] || 0;
    }
}

module.exports = BaseDataQualityAnalyzer; 