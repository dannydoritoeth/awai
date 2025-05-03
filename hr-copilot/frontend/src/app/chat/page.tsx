'use client';

import { useSearchParams } from 'next/navigation';
import UnifiedResultsView from '../components/UnifiedResultsView';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const context = searchParams.get('context') as 'employee' | 'role' | 'open';
  const id = searchParams.get('id');

  // In a real implementation, we would fetch the data based on context and id
  const mockEmployeeData = context === 'employee' ? {
    name: "John Smith",
    currentRole: "Software Engineer",
    department: "Engineering",
    tenure: "2 years",
    skills: ["JavaScript", "React", "Node.js", "TypeScript"],
    preferences: {
      desiredRoles: ["Senior Software Engineer", "Tech Lead", "Engineering Manager"]
    }
  } : null;

  const mockRoleData = context === 'role' ? {
    id: "1",
    title: "Senior Software Engineer",
    department: "Engineering",
    location: "Remote",
    description: "We're looking for a senior software engineer to join our team...",
    requirements: [
      "5+ years of experience with web technologies",
      "Strong knowledge of JavaScript and TypeScript",
      "Experience with React and Node.js"
    ],
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "AWS"]
  } : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-blue-950">AI Assistant</h1>
          <p className="text-lg text-gray-600">
            Chat with AI to find the perfect match for roles and candidates
          </p>
        </div>
        
        <UnifiedResultsView
          employeeData={mockEmployeeData}
          roleData={mockRoleData}
          startContext={context || 'open'}
        />
      </div>
    </div>
  );
} 