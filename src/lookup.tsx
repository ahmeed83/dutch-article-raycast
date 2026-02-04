// @ts-nocheck
import { useState, useEffect } from "react";
import {
  Action,
  ActionPanel,
  List,
  showToast,
  Toast,
  Clipboard,
  Icon,
  Color,
} from "@raycast/api";
import { dutchWords } from "./words";

async function lookupArticle(word: string): Promise<ArticleResult> {
  const trimmedWord = word.trim().toLowerCase();

  if (!trimmedWord) {
    return { word: "", article: "unknown", fullWord: "", source: "local" };
  }

  // Check local dictionary first
  if (dutchWords[trimmedWord]) {
    const article = dutchWords[trimmedWord];
    const fullWord = article === "both"
      ? `het/de ${trimmedWord}`
      : `${article} ${trimmedWord}`;
    return { word: trimmedWord, article, fullWord, source: "local" };
  }

  try {
    const response = await fetch(
      `https://welklidwoord.nl/${encodeURIComponent(trimmedWord)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          Accept: "text/html,application/xhtml+xml",
        },
      }
    );
    const html = await response.text();

    // Check for "het" in various formats
    const isHet =
      html.includes(`<strong>Het</strong>`) ||
      html.includes(`>Het ${trimmedWord}<`) ||
      html.includes(`Het ${trimmedWord}`) ||
      new RegExp(`<h1[^>]*>\\s*Het\\s+${trimmedWord}`, "i").test(html);

    // Check for "de" in various formats
    const isDe =
      html.includes(`<strong>De</strong>`) ||
      html.includes(`>De ${trimmedWord}<`) ||
      html.includes(`De ${trimmedWord}`) ||
      new RegExp(`<h1[^>]*>\\s*De\\s+${trimmedWord}`, "i").test(html);

    if (isHet && isDe) {
      return {
        word: trimmedWord,
        article: "both",
        fullWord: `het/de ${trimmedWord}`,
        source: "online",
      };
    } else if (isHet) {
      return {
        word: trimmedWord,
        article: "het",
        fullWord: `het ${trimmedWord}`,
        source: "online",
      };
    } else if (isDe) {
      return {
        word: trimmedWord,
        article: "de",
        fullWord: `de ${trimmedWord}`,
        source: "online",
      };
    }

    return { word: trimmedWord, article: "unknown", fullWord: trimmedWord, source: "online" };
  } catch (error) {
    console.error("Error looking up article:", error);
    return { word: trimmedWord, article: "unknown", fullWord: trimmedWord, source: "local" };
  }
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [result, setResult] = useState<ArticleResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!searchText.trim()) {
      setResult(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const articleResult = await lookupArticle(searchText);
        setResult(articleResult);
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: "Failed to look up article",
        });
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  const getArticleColor = (article: string): Color => {
    if (article === "het") return Color.Orange;
    if (article === "de") return Color.Blue;
    if (article === "both") return Color.Purple;
    return Color.SecondaryText;
  };

  const getArticleIcon = (article: string) => {
    if (article === "het") return Icon.CircleFilled;
    if (article === "de") return Icon.Circle;
    if (article === "both") return Icon.CircleEllipsis;
    return Icon.QuestionMarkCircle;
  };

  const getSubtitle = (result: ArticleResult) => {
    if (result.article === "unknown") {
      return "Article not found - try a different spelling";
    }
    if (result.article === "both") {
      return 'This word can use both "het" and "de"';
    }
    return `The article is "${result.article}"`;
  };

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Type a Dutch noun (e.g., huis, auto, kind)..."
      throttle
    >
      {result && result.word && (
        <List.Section title="Result">
          <List.Item
            icon={{
              source: getArticleIcon(result.article),
              tintColor: getArticleColor(result.article),
            }}
            title={result.article === "unknown" ? result.word : result.fullWord}
            subtitle={getSubtitle(result)}
            accessories={[
              {
                tag: {
                  value: result.article.toUpperCase(),
                  color: getArticleColor(result.article),
                },
              },
            ]}
            actions={
              <ActionPanel>
                <Action
                  title="Copy Full Word"
                  icon={Icon.Clipboard}
                  onAction={async () => {
                    await Clipboard.copy(
                      result.article === "unknown" ? result.word : result.fullWord
                    );
                    showToast({
                      style: Toast.Style.Success,
                      title: "Copied!",
                      message: result.fullWord || result.word,
                    });
                  }}
                />
                {result.article !== "unknown" && (
                  <Action
                    title="Copy Article Only"
                    icon={Icon.Text}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                    onAction={async () => {
                      const articleText = result.article === "both" ? "het/de" : result.article;
                      await Clipboard.copy(articleText);
                      showToast({
                        style: Toast.Style.Success,
                        title: "Copied!",
                        message: articleText,
                      });
                    }}
                  />
                )}
                <Action.OpenInBrowser
                  title="Open in Welklidwoord.nl"
                  url={`https://welklidwoord.nl/${encodeURIComponent(result.word)}`}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
      {!result && !isLoading && (
        <List.EmptyView
          icon={{ source: Icon.Book, tintColor: Color.Orange }}
          title="Het of De?"
          description="Type a Dutch noun to find out if it uses 'het' or 'de'"
        />
      )}
    </List>
  );
}
