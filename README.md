# partnered-youtube-reddit
Automatically set the flair of a reddit user based on their post

# Installation directions for noobs 

set up folder for install 
Copy folder path -- eg  C:\Users\(user)\Documents\partnered-youtube-bot
install node.js from internet 

Route 1: Download code manually
open repro, click code, download zip
unpack zip
right click on extracted folder, open in terminal 

Route 2: Install Github Desktop
Do stuff and things 

First time set up only:
open cmd in folder then run "npm install" This installs all packages for projects. 

Set up .env file 
- Reddit Credentials (reddit user needs flair permissions on relevant subreddits) 
- Reddit app key 
- API key 
- Set origin/target subreddit
- Set up flair / get flair ids 

To run: 
Open terminal in installation folder and run "npm start"

To change subreddit article... EXTRACT string between "comments/" and "rpartneredyoutube" from url as shown in this example:  
https://www.reddit.com/r/Flammy/comments/17qn2wd/rpartneredyoutube_optional_verification_beta/
and add to .env file 


