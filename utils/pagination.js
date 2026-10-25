const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export const getPagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT),
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

export const buildPagination = (page, limit, totalItems) => ({
  currentPage: page,
  totalPages: Math.ceil(totalItems / limit),
  totalItems,
  limit,
});
