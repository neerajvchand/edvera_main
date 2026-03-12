import { useState } from "react";
import { AcademicPulse, AcademicInsight, MissingAssignment } from "@/types/schoolpulse";
import { 
  CheckCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown, 
  Minus, ChevronRight, ChevronDown, BookOpen, Lightbulb, Star, Sparkles, Clock
} from "lucide-react";

interface AcademicPulseCardProps {
  academic: AcademicPulse;
  onInsightTap: (insight: AcademicInsight) => void;
  onMissingAssignmentTap: (assignment: MissingAssignment) => void;
}

export function AcademicPulseCard({ academic, onInsightTap, onMissingAssignmentTap }: AcademicPulseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusConfig = () => {
    switch (academic.overallStatus) {
      case 'good':
        return {
          containerClass: 'status-container-success',
          icon: CheckCircle,
          label: 'Looking Good',
          emoji: '✅',
          description: 'All grades on track, no missing work'
        };
      case 'watch':
        return {
          containerClass: 'status-container-warning',
          icon: AlertTriangle,
          label: 'Heads Up',
          emoji: '⚠️',
          description: 'Some items need your attention'
        };
      case 'concern':
        return {
          containerClass: 'status-container-urgent',
          icon: XCircle,
          label: 'Action Needed',
          emoji: '🔴',
          description: 'Missing work or grade concerns'
        };
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />;
      case 'down':
        return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
      case 'stable':
        return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getInsightIcon = (type: AcademicInsight['type']) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'celebration':
        return <Star className="w-4 h-4 text-amber-500" />;
      case 'tip':
        return <Lightbulb className="w-4 h-4 text-blue-500" />;
      case 'pattern':
        return <Sparkles className="w-4 h-4 text-purple-500" />;
    }
  };

  const config = getStatusConfig();
  const highPriorityInsights = academic.insights.filter(i => i.priority === 'high');
  const hasUrgentItems = academic.missingAssignments.length > 0 || highPriorityInsights.length > 0;

  return (
    <div 
      className="pulse-card animate-fade-in"
      style={{ animationDelay: "0.12s" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">
          Academic Pulse
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Synced {academic.lastSyncTime}</span>
        </div>
      </div>

      {/* AI Summary */}
      <div className={`${config.containerClass} rounded-xl p-4 mb-4`}>
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">{config.emoji}</span>
          <div className="flex-1">
            <p className="font-semibold text-base">{config.label}</p>
            <p className="text-sm mt-1">{academic.aiSummary}</p>
          </div>
          {academic.gpa && (
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold">{academic.gpa}</p>
              <p className="text-xs text-muted-foreground">GPA</p>
            </div>
          )}
        </div>
      </div>

      {/* Missing Assignments Alert */}
      {academic.missingAssignments.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-status-urgent-text mb-2 flex items-center gap-1">
            <XCircle className="w-4 h-4" />
            Missing Assignments ({academic.missingAssignments.length})
          </p>
          <div className="space-y-2">
            {academic.missingAssignments.slice(0, 3).map(assignment => (
              <div
                key={assignment.id}
                className="action-item-box flex items-center justify-between"
                onClick={() => onMissingAssignmentTap(assignment)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onMissingAssignmentTap(assignment)}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{assignment.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {assignment.subject} • {assignment.daysOverdue} days overdue
                  </p>
                </div>
                <span className="text-xs font-medium text-status-urgent-text">
                  {assignment.pointsPossible} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {highPriorityInsights.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Insights
          </p>
          <div className="space-y-2">
            {highPriorityInsights.slice(0, 2).map(insight => (
              <div
                key={insight.id}
                className="action-item-box flex items-start gap-2"
                onClick={() => onInsightTap(insight)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onInsightTap(insight)}
              >
                {getInsightIcon(insight.type)}
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{insight.title}</p>
                  <p className="text-xs text-muted-foreground">{insight.description}</p>
                </div>
                {insight.actionRequired && (
                  <span className="text-xs px-2 py-0.5 bg-status-urgent-bg text-status-urgent-text rounded-full font-medium">
                    Action
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expand/Collapse for grades */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
      >
        {isExpanded ? (
          <>
            <ChevronDown className="w-3 h-3" />
            Hide grades
          </>
        ) : (
          <>
            <ChevronRight className="w-3 h-3" />
            View all grades ({academic.grades.length} classes)
          </>
        )}
      </button>

      {/* Expanded grades view */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="space-y-2">
            {academic.grades.map((grade, index) => (
              <div 
                key={index}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{grade.subject}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${
                    grade.currentGrade.startsWith('A') ? 'text-emerald-600' :
                    grade.currentGrade.startsWith('B') ? 'text-blue-600' :
                    grade.currentGrade.startsWith('C') ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {grade.currentGrade}
                  </span>
                  {getTrendIcon(grade.trend)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
