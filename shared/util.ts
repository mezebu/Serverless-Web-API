import { marshall } from "@aws-sdk/util-dynamodb";
import { MovieReview } from "./types";

export const generateMovieReviewItem = (review: MovieReview) => {
  return {
    PutRequest: {
      Item: marshall(review),
    },
  };
};

export const generateBatch = (data: MovieReview[]) => {
  return data.map((e) => {
    return generateMovieReviewItem(e);
  });
};
