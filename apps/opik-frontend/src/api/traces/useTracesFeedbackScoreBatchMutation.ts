import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import get from "lodash/get";

import api, { TRACES_REST_ENDPOINT } from "@/api/api";
import { useToast } from "@/components/ui/use-toast";
import { FeedbackScoreBatch } from "@/types/traces";

type UseTracesFeedbackScoreBatchMutationParams = {
  feedbackScoreBatch: FeedbackScoreBatch;
};

const useTracesFeedbackScoreBatchMutation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      feedbackScoreBatch,
    }: UseTracesFeedbackScoreBatchMutationParams) => {
      const { data } = await api.put(
        `${TRACES_REST_ENDPOINT}feedback-scores`,
        feedbackScoreBatch,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["traces"],
      });
      queryClient.invalidateQueries({
        queryKey: ["trace"],
      });
      toast({
        description: "Feedback scores updated successfully",
      });
    },
    onError: (error: AxiosError) => {
      const message = get(
        error,
        ["response", "data", "message"],
        error.message,
      );

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });
};

export default useTracesFeedbackScoreBatchMutation;
