export type Job = {
    jobId: string;
    title: string;
    department: string;
    location: string;
    salary: string;
    closingDate: string;
    sourceUrl: string;
    source?: string;
    institution: string;
    details?: {
        documents?: any[];
    };
};

export type Department = {
    name: string;
    jobs: Job[];
}; 