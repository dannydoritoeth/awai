'use client';

import UnifiedResultsView from '../../components/UnifiedResultsView';
import { useEffect, useState, use } from 'react';

// Sample data for testing
const SAMPLE_EMPLOYEE = {
  name: "John Smith",
  currentRole: "Full Stack Developer",
  department: "Engineering",
  tenure: "2 years",
  skills: ["React", "TypeScript", "Node.js", "Python", "AWS"],
  preferences: {
    desiredRoles: ["Senior Developer", "Tech Lead", "Engineering Manager"]
  }
};

const SAMPLE_ROLE = {
  id: "1",
  title: "Senior Software Engineer",
  department: "Engineering",
  location: "Remote",
  description: "We're looking for an experienced software engineer to join our team...",
  requirements: [
    "5+ years of experience in software development",
    "Strong knowledge of React and TypeScript",
    "Experience with cloud platforms (AWS/GCP/Azure)"
  ],
  skills: ["React", "TypeScript", "Node.js", "AWS", "System Design"]
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ChatPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [chatData, setChatData] = useState<{
    type: 'role' | 'candidate' | 'general';
    employeeData?: typeof SAMPLE_EMPLOYEE;
    roleData?: typeof SAMPLE_ROLE;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading chat data
    const loadChatData = async () => {
      setIsLoading(true);
      try {
        const id = resolvedParams.id;
        console.log('Loading chat data for ID:', id); // Debug log
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For testing, let's show different data based on the ID
        if (id === '1') {
          setChatData({
            type: 'role',
            roleData: SAMPLE_ROLE
          });
        } else if (id === '2') {
          setChatData({
            type: 'candidate',
            employeeData: SAMPLE_EMPLOYEE
          });
        } else {
          setChatData({
            type: 'general'
          });
        }
      } catch (error) {
        console.error('Error loading chat data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChatData();
  }, [resolvedParams.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading chat...</div>
      </div>
    );
  }

  // Map the chat data type to UnifiedResultsView context type
  const getStartContext = () => {
    if (!chatData) return 'open';
    switch (chatData.type) {
      case 'role':
        return 'role';
      case 'candidate':
        return 'employee';
      default:
        return 'open';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <UnifiedResultsView
        employeeData={chatData?.employeeData}
        roleData={chatData?.roleData}
        startContext={getStartContext()}
      />
    </div>
  );
} 