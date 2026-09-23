FROM node:22-alpine

WORKDIR /app

# NEXT_PUBLIC_* variables are inlined into the client bundle at build time,
# so they must be present during `npm run build`, not just at runtime.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production image serves the prebuilt app; docker-compose overrides this
# with `npm run dev` for local development.
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
