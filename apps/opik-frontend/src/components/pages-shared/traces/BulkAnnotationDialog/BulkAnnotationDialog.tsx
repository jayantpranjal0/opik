import React, { useCallback, useMemo, useState } from "react";
import { DialogClose } from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trace, Span, FEEDBACK_SCORE_TYPE, FeedbackScoreBatchItem } from "@/types/traces";
import { FeedbackDefinition } from "@/types/feedback-definitions";
import useAppStore from "@/store/AppStore";
import useFeedbackDefinitionsList from "@/api/feedback-definitions/useFeedbackDefinitionsList";
import { sortBy } from "lodash";
import AnnotateRow from "@/components/pages-shared/traces/TraceDetailsPanel/TraceAnnotateViewer/AnnotateRow";
import { UpdateFeedbackScoreData } from "@/components/pages-shared/traces/TraceDetailsPanel/TraceAnnotateViewer/types";
import useTracesFeedbackScoreBatchMutation from "@/api/traces/useTracesFeedbackScoreBatchMutation";
import { cn } from "@/lib/utils";
import UserCommentForm from "@/components/pages-shared/traces/UserComment/UserCommentForm";

type BulkAnnotationDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedTraces: Array<Trace | Span>;
  projectName: string;
};

type FeedbackScoreRowData = {
  name: string;
  feedbackDefinition?: FeedbackDefinition;
  value?: number;
  categoryName?: string;
  reason?: string;
};


const BulkAnnotationDialog: React.FunctionComponent<BulkAnnotationDialogProps> = ({
  open,
  setOpen,
  selectedTraces,
  projectName,
}) => {
  const workspaceName = useAppStore((state) => state.activeWorkspaceName);
  const [feedbackScores, setFeedbackScores] = useState<Record<string, FeedbackScoreRowData>>({});
  const [globalComment, setGlobalComment] = useState("");
  const [commentFormValue, setCommentFormValue] = useState<string>("");

  const { data: feedbackDefinitionsData } = useFeedbackDefinitionsList({
    workspaceName,
    page: 1,
    size: 1000,
  });

  const tracesFeedbackScoreBatchMutation = useTracesFeedbackScoreBatchMutation();

  const feedbackDefinitions: FeedbackDefinition[] = useMemo(
    () => feedbackDefinitionsData?.content || [],
    [feedbackDefinitionsData?.content],
  );

  const rows: FeedbackScoreRowData[] = useMemo(() => {
    return sortBy(
      feedbackDefinitions.map((feedbackDefinition) => {
        const existingScore = feedbackScores[feedbackDefinition.name] || {};
        return {
          name: feedbackDefinition.name,
          feedbackDefinition,
          value: existingScore.value,
          categoryName: existingScore.categoryName,
          reason: existingScore.reason,
        };
      }),
      "name",
    );
  }, [feedbackDefinitions, feedbackScores]);

  const handleUpdateFeedbackScore = useCallback((update: UpdateFeedbackScoreData) => {
    setFeedbackScores(prev => ({
      ...prev,
      [update.name]: {
        name: update.name,
        value: update.value,
        categoryName: update.categoryName,
        reason: update.reason,
      },
    }));
  }, []);

  const handleDeleteFeedbackScore = useCallback((name: string) => {
    setFeedbackScores(prev => {
      const { [name]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleApplyAnnotations = useCallback(async () => {
    const batchItems: FeedbackScoreBatchItem[] = [];

    Object.values(feedbackScores).forEach(score => {
      if (score.value !== undefined) {
        selectedTraces.forEach(trace => {
          batchItems.push({
            id: trace.id,
            projectName,
            name: score.name,
            categoryName: score.categoryName,
            value: score.value!,
            // Use per-score reason if set, otherwise use global comment
            reason: score.reason || globalComment || undefined,
            source: FEEDBACK_SCORE_TYPE.ui,
          });
        });
      }
    });

    if (batchItems.length > 0) {
      await tracesFeedbackScoreBatchMutation.mutateAsync({
        feedbackScoreBatch: { scores: batchItems },
      });
      setOpen(false);
      setFeedbackScores({}); // Reset form
      setGlobalComment("");
    }
  }, [feedbackScores, selectedTraces, projectName, tracesFeedbackScoreBatchMutation, setOpen, globalComment]);

  const hasValidScores = useMemo(() => {
    return Object.values(feedbackScores).some(score => score.value !== undefined);
  }, [feedbackScores]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Annotate Traces</DialogTitle>
          <DialogDescription>
            Add feedback scores to {selectedTraces.length} selected trace{selectedTraces.length !== 1 ? 's' : ''}.
            These annotations will be applied to all selected traces.
          </DialogDescription>
        </DialogHeader>
        {/* User comment form */}
        <div className="mb-4">
          <UserCommentForm
            onSubmit={({ commentText }) => setGlobalComment(commentText)}
            commentText={globalComment}
            actions={null}
            className="w-full"
          >
            <label className="block mb-1 font-medium">Comment (applied to all, unless overridden per score):</label>
            <UserCommentForm.TextareaField placeholder="Add a comment to apply to all selected traces..." />
          </UserCommentForm>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <div className="flex flex-col px-2">
            <div className="flex items-center gap-1 pb-2">
              <span className="comet-body-s-accented truncate">Human review</span>
            </div>
            <div className="grid max-w-full grid-cols-[minmax(0,5fr)_minmax(0,5fr)__36px_30px] border-b border-border empty:border-transparent">
              {rows.map((row) => (
                <AnnotateRow
                  key={row.name}
                  name={row.name}
                  feedbackDefinition={row.feedbackDefinition}
                  feedbackScore={row.value !== undefined ? {
                    name: row.name,
                    value: row.value,
                    category_name: row.categoryName,
                    reason: row.reason,
                    source: FEEDBACK_SCORE_TYPE.ui,
                  } : undefined}
                  onUpdateFeedbackScore={handleUpdateFeedbackScore}
                  onDeleteFeedbackScore={handleDeleteFeedbackScore}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleApplyAnnotations}
            disabled={!hasValidScores || tracesFeedbackScoreBatchMutation.isPending}
          >
            {tracesFeedbackScoreBatchMutation.isPending ? "Applying..." : "Apply Annotations"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAnnotationDialog;
