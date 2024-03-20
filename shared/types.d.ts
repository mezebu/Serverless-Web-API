export type MovieReview = {
  movieId: number;
  reviewer_name: string;
  review_date: string;
  content: string;
  rating: number;
};

export type MovieReviewQueryParams = {
  movieId?: string;
  minRating?: string;
};

export type LanguageQueryParams = {
  language?: string;
};

export type SignUpBody = {
  username: string;
  password: string;
  email: string;
};

export type ConfirmSignUpBody = {
  username: string;
  code: string;
};

export type SignInBody = {
  username: string;
  password: string;
};
