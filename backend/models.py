from pydantic import BaseModel


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
    userEmailHash: str
    alter: int
    religionsangehoerigkeit: str
    bildungsabschluss: str
    herkunft: str
    politischeEinstellung: int


class ThemeLocalizationEntry(BaseModel):
    theme: str
    post1: bool
    post2: bool
    post3: bool
    post4: bool
    post5: bool


class BlockSurveySubmission(BaseModel):
    blockNumber: int
    userEmailHash: str
    alter: int
    religionsangehoerigkeit: str
    bildungsabschluss: str
    herkunft: str
    politischeEinstellung: int
    themes: dict[str, bool]
    localizations: list[ThemeLocalizationEntry]
