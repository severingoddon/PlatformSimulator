from pydantic import BaseModel, Field

# Participant ID passed in from the survey link (e.g. Qualtrics ResponseID).
# Restricted to safe characters so it can be written to CSV as-is.
Pid = Field(pattern=r"^[A-Za-z0-9_-]{1,100}$")


class PostData(BaseModel):
    postId: str
    profileName: str
    imageUrl: str
    blockNumber: int
    postPosition: int


class PostsResponse(BaseModel):
    posts: list[PostData]


class PostFeedback(BaseModel):
    postId: str
    blockNumber: int
    postPosition: int
    liked: bool
    followed: bool
    saved: bool
    shared: bool
    pid: str = Pid


class ThemeLocalizationEntry(BaseModel):
    theme: str
    post1: bool
    post2: bool
    post3: bool
    post4: bool
    post5: bool


class BlockSurveySubmission(BaseModel):
    blockNumber: int
    pid: str = Pid
    themes: dict[str, bool]
    localizations: list[ThemeLocalizationEntry]
